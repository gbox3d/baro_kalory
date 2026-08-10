#!/usr/bin/env node
// 프론트 정적 서버 — nginx 가 없는 환경(로컬 개발·Windows)용.
//
// 배포에서는 리버스 프록시나 정적 호스트가 이 역할을 하고, 이 서버는 그 동작의 미러다 —
// 정적(페이지·/web/·public 폴백)은 직접 서빙하고, 동적(/api/*, /home-frame/*)은 backend 로
// 프록시한다. 라우팅을 바꾸면 리버스 프록시 설정도 함께 바꿀 것.
//
//   node server.mjs                 # :8180, backend http://127.0.0.1:8080
//   node server.mjs --port 80 --backend http://192.0.2.10:8080
//
// 기본 포트가 8180 인 이유: 808x(8081~) 는 UE 시뮬레이터 카메라의 HTTP 포트 규약이고
// (BaseHttpPort 8081 = cam1, config 의 sim-cam-* 이 이 개발기 LAN IP:8081 을 씀),
// 809x 는 시뮬 MJPEG 대역이다. 8081 을 기본으로 썼다가 시뮬과 정면 충돌한 리뷰 발견 반영.
// 기본 바인딩은 127.0.0.1 — 이 프록시는 무인증이라 LAN 노출은 명시적 선택(--host 0.0.0.0)이어야 한다.
//
// 프록시가 지켜야 하는 계약 두 가지:
//  - 마운트 무관: 이 앱은 어느 프리픽스에 걸려도 동작한다(기본은 루트). 프록시는 자기
//    마운트를 벗긴 경로를 backend 로 보낸다 — 프리픽스는 배포 결정이지 backend 의 사실이
//    아니기 때문이다. 다른 마운트로 띄우려면 --base /prefix.
//  - 연결 수명 전달: backend 는 MJPEG 클라이언트 수로 카메라 수요를 판정한다(수요 기반
//    생명주기). 브라우저가 끊으면 업스트림 요청도 즉시 destroy 해야 카메라가 유휴로 풀린다 —
//    안 하면 프록시가 유령 시청자로 남아 카메라를 영구 점유한다.

import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { pipeline } from "node:stream";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// .env 는 있으면 읽고 없으면 조용히 넘어간다(gitignore — 호스트마다 다르다). 우선순위는
// CLI 플래그 > 환경변수 > .env > 기본값 — 이미 셸에 있는 값을 .env 가 덮지 않는다.
// 의존성을 들이지 않으려고 node 내장 loadEnvFile 을 쓴다.
try {
  const before = { ...process.env };
  process.loadEnvFile(resolve(here, ".env"));
  for (const k of Object.keys(before)) if (before[k] !== undefined) process.env[k] = before[k];
} catch { /* .env 없음 — 정상 */ }
const publicDir = resolve(here, "public");
const webSrcDir = resolve(here, "src");

// 마운트 프리픽스는 배포 결정이다 — 기본은 루트("")다. 한 호스트에서 여러 서비스를
// 구분하려고 프리픽스를 쓰는 배포라면 --base /prefix 로 준다(nginx conf 와 짝을 맞춘다).
function normalizeBase(v) {
  const s = String(v || "").trim().replace(/\/+$/, "");
  if (!s) return "";
  return s.startsWith("/") ? s : `/${s}`;
}

// 페이지 라우팅. 페이지 HTML 이 상대경로(./app.css·./web/*)를 쓰므로(마운트 프리픽스 무관화) 문서
// URL 은 정규형 하나여야 한다 — /cctv/ 처럼 슬래시로 끝나면 상대 해석이 한 단계 어긋나
// 자산이 전부 404 가 된다. 슬래시 변형은 301 로 정규화(nginx conf 도 동일).
const PAGE_ROUTES = {
  "/": "home.html",
  "/cctv": "cctv.html",
  "/discovery": "discovery.html",
  "/simulator": "simulator.html",
  "/settings": "settings.html",
  "/calibration": "calibration.html",
  "/height": "height.html",
  "/v0": "cctv.html",
};
const PAGE_REDIRECTS = {
  "/cctv/": "/cctv", "/simulator/": "/simulator", "/v0/": "/v0",
  "/settings/": "/settings", "/calibration/": "/calibration", "/discovery/": "/discovery",
  "/height/": "/height",
};

function optionValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const BASE_PATH = normalizeBase(optionValue("--base") || process.env.BARO_FRONTEND_BASE || "");
const port = Number(optionValue("--port") || process.env.BARO_FRONTEND_PORT || 8180);
const host = optionValue("--host") || process.env.BARO_FRONTEND_HOST || "127.0.0.1";
const backendOrigin = new URL(optionValue("--backend") || process.env.BARO_BACKEND_URL || "http://127.0.0.1:8080");
// backend 는 https 일 수 있다(터널·CDN 뒤). 스킴을 안 가르면 node:http 로 443 이 아닌 80 을
// 치게 되는데, 그게 통하는 호스트가 있어서 **되는 것처럼 보이다가** TLS 전용 호스트에서만
// 조용히 죽는다 — 그런 실패는 원인을 찾는 데 시간이 가장 많이 든다.
const backendIsTls = backendOrigin.protocol === "https:";
const backendPort = Number(backendOrigin.port) || (backendIsTls ? 443 : 80);
// backend 가 마운트 아래 있는 배포(`https://호스트/calory`)가 정상이다 — .env.example 이 그
// 형태를 문서화하고 브라우저 쪽 cleanApiBase 도 경로를 보존한다. 여기서만 떨어뜨리면 개발
// 프록시가 말없이 루트를 쳐서 404 를 "백엔드가 이상하다"로 오인하게 만든다.
const backendMount = backendOrigin.pathname.replace(/\/+$/, "");
// 화면(설정 탭)이 "지금 어느 backend 를 보고 있나"에 답할 때 쓰는 값 — 마운트까지가 답이다.
const backendLabel = `${backendOrigin.origin}${backendMount}`;

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

// Serve a single file from baseDir, guarding against path traversal outside it.
async function serveFromDir(res, baseDir, relPath) {
  const filePath = resolve(baseDir, relPath.replace(/^\/+/, ""));
  if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    // no-cache: 배포 직후 브라우저가 '새 페이지 + 옛 모듈'을 섞어 무는 stale 프런트 회귀(실측)
    // 방지 — backend 가 정적을 서빙하던 시절부터의 정책을 그대로 잇는다. nginx conf 도 동일.
    res.writeHead(200, { "content-type": contentTypeFor(filePath), "cache-control": "no-cache" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}

// 디렉터리 인덱스 해석: 슬래시 종단 경로는 그 폴더의 index.html. 확장자 없는 경로는
// 문서를 직접 서빙하지 않고 슬래시 종단으로 301 한다(리버스 프록시 미러) — `<mount>/test` 를
// 그 URL 로 200 서빙하면 문서 base 가 한 단계 얕아져 ../web/ 상대 import 가 base 를
// 탈출, 페이지 JS 전체가 죽는다(리뷰 확정 — 상대경로화가 만든 회귀).
async function serveStatic(res, pathname, search = "") {
  let rel = pathname.replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  else if (!extname(rel)) {
    res.writeHead(301, { location: `${BASE_PATH}${pathname}/${search}` });
    res.end();
    return;
  }
  await serveFromDir(res, publicDir, rel);
}

// upstreamPath 는 **이 서버의 마운트를 이미 벗긴** 경로다(호출부에서 벗긴다). backend 에
// 우리 프리픽스를 넘기지 않는 이유: 프리픽스는 이 배포의 사실이지 backend 가 아는 것이 아니다.
function proxyToBackend(req, res, upstreamPath) {
  // Host 헤더는 **backend 가 아는 자기 이름**이어야 한다(포트가 기본이면 붙이지 않는다) —
  // TLS 뒤의 가상호스트·터널은 이 값으로 라우팅하므로 어긋나면 404 나 인증서 오류가 난다.
  const upstream = (backendIsTls ? httpsRequest : httpRequest)({
    host: backendOrigin.hostname,
    port: backendPort,
    method: req.method,
    path: `${backendMount}${upstreamPath}`,
    headers: { ...req.headers, host: backendOrigin.host },
    ...(backendIsTls ? { servername: backendOrigin.hostname } : {}),
  });
  upstream.on("response", (up) => {
    // 브라우저는 프록시 뒤의 backend 를 알 수 없다 — API 가 동일 출처로 보이기 때문이다.
    // 그래서 "지금 어느 backend 를 보고 있나"를 화면이 답할 수 없었다(설정 탭 공란).
    // 프록시만 아는 사실이므로 프록시가 실어 보낸다. nginx conf 도 같은 헤더를 보낸다.
    res.writeHead(up.statusCode || 502, { ...up.headers, "x-baro-upstream": backendLabel });
    // pipe() 가 아니라 pipeline(): backend 가 응답 도중 FIN 으로 죽으면(pm2 restart 가 정확히
    // 이 경우 — SIGTERM 핸들러가 없어 즉시 종료) pipe() 는 res 를 끝내지 않아 클라이언트가
    // 영구 대기한다(MJPEG 뷰어 무한 동결, 실측 재현). pipeline 은 소스 조기 종료를 res 파괴로
    // 전파해 브라우저 <img> 의 onerror/재연결 루프가 살아난다. nginx 의 upstream-close 전파와 동일.
    pipeline(up, res, () => {});
  });
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json", "x-baro-upstream": backendLabel });
      res.end(JSON.stringify({ error: `backend 에 연결할 수 없습니다 (${backendLabel})` }));
    } else {
      res.destroy();
    }
  });
  // 클라이언트가 끊으면 업스트림도 즉시 끊는다 — MJPEG 수요 판정이 이 신호에 의존한다.
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);

    // 모든 301 은 쿼리스트링을 보존해야 한다 — ?api=reset(벽돌 탈출구)·?api= 공유링크가
    // 슬래시 변형 URL 에서 리다이렉트로 유실되면 정확히 필요한 순간에 무력화된다(리뷰 확정).
    // 마운트가 있는 배포에서만 프리픽스 정규화·게이트가 의미를 갖는다. 루트 마운트(기본)에서
    // 이 블록을 그대로 두면 "/" 가 "/" 로 301 하는 무한 루프가 된다.
    if (BASE_PATH) {
      if (pathname === "/" || pathname === BASE_PATH) {
        res.writeHead(301, { location: `${BASE_PATH}/${url.search}` });
        res.end();
        return;
      }
      if (!pathname.startsWith(`${BASE_PATH}/`)) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: `이 서버의 모든 경로는 ${BASE_PATH}/ 아래에 있습니다` }));
        return;
      }
      pathname = pathname.slice(BASE_PATH.length);
    }

    // 동적은 전부 backend 로 — **마운트를 벗긴** 경로로 보낸다(쿼리스트링 보존).
    // 프리픽스는 이 배포의 사실일 뿐이라 backend 에 그대로 넘기면 그쪽 마운트와 어긋난다.
    if (pathname.startsWith("/api/") || pathname.startsWith("/home-frame/")) {
      proxyToBackend(req, res, `${pathname}${url.search}`);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "정적 서버는 GET/HEAD 만 받습니다" }));
      return;
    }
    if (pathname.startsWith("/web/")) {
      await serveFromDir(res, webSrcDir, pathname.slice("/web/".length));
      return;
    }
    if (Object.prototype.hasOwnProperty.call(PAGE_REDIRECTS, pathname)) {
      res.writeHead(301, { location: `${BASE_PATH}${PAGE_REDIRECTS[pathname]}${url.search}` });
      res.end();
      return;
    }
    if (Object.prototype.hasOwnProperty.call(PAGE_ROUTES, pathname)) {
      await serveFromDir(res, publicDir, PAGE_ROUTES[pathname]);
      return;
    }
    await serveStatic(res, pathname, url.search);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(error && error.message || error) }));
    } else {
      res.destroy();
    }
  }
});

server.listen({ port, host }, () => {
  console.log(`[frontend] http://localhost:${port}${BASE_PATH}/  (bind ${host}, backend → ${backendLabel})`);
});
