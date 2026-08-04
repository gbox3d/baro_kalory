// 프론트 정적 서버 통합 테스트 — 실제 프로세스를 띄워 nginx 미러 동작을 검증한다.
// (분리 결정의 수호 테스트: 페이지·브라우저 모듈은 이 서버가, /api/* 는 backend 프록시가.)
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";

const serverPath = new URL("../server.mjs", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1"); // Windows drive-letter URL → path

async function until(fn, { timeout = 5000, step = 50 } = {}) {
  const t0 = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch {}
    if (Date.now() - t0 > timeout) throw new Error("until: timeout");
    await new Promise((r) => setTimeout(r, step));
  }
}

test("정적 서빙 + API 프록시 (nginx 미러)", async (t) => {
  // 스텁 backend — 받은 경로를 기록해 "마운트를 벗긴 경로가 도달한다"는 계약을 검증한다.
  const seen = [];
  const stub = createServer((req, res) => {
    seen.push(req.url);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  stub.listen(0, "127.0.0.1");
  await once(stub, "listening");
  const stubPort = stub.address().port;

  const port = 18000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, [
    serverPath, "--port", String(port), "--backend", `http://127.0.0.1:${stubPort}`,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { child.kill(); stub.close(); });

  const base = `http://127.0.0.1:${port}`;
  await until(async () => (await fetch(`${base}/`)).ok);

  // 1. 페이지 라우트 — home/cctv/simulator/settings/calibration/v0
  for (const [route, marker] of [
    ["/", "data-version-key=\"cctv\""],
    ["/cctv", "id=\"stage\""],
    ["/v0", "id=\"stage\""],
    ["/simulator", "initPageChrome({ page: \"simulator\" })"],
    ["/discovery", "id=\"disc-wrap\""],
    ["/settings", "id=\"set-panel\""],
    ["/calibration", "id=\"calib-card\""],
  ]) {
    const r = await fetch(base + route);
    assert.equal(r.status, 200, route);
    assert.match(r.headers.get("content-type"), /text\/html/, route);
    assert.ok((await r.text()).includes(marker), `${route} 가 기대한 문서가 아님`);
  }

  // 1b. 슬래시 변형은 301 정규화 — 페이지가 상대경로(./app.css)를 쓰므로 문서 URL 이
  // /cctv/ 로 끝나면 자산 해석이 한 단계 어긋난다. 정규형 하나만 문서를 서빙해야 한다.
  for (const [from, to] of [
    ["/cctv/", "/cctv"],
    ["/simulator/", "/simulator"],
    ["/discovery/", "/discovery"],
    ["/settings/", "/settings"],
    ["/calibration/", "/calibration"],
    ["/v0/", "/v0"],
  ]) {
    const r = await fetch(base + from, { redirect: "manual" });
    assert.equal(r.status, 301, from);
    assert.equal(r.headers.get("location"), to, from);
  }

  // 1c. 301 은 쿼리를 보존해야 한다 — ?api=reset 탈출구가 리다이렉트에서 증발하면
  // 벽돌 복구가 정확히 필요한 순간에 실패한다(리뷰 확정 결함의 회귀 그물).
  // /settings 는 특히 치명적: API base 를 잘못 저장한 벽돌을 푸는 카드가 바로 그 페이지다.
  const rq = await fetch(`${base}/cctv/?api=reset`, { redirect: "manual" });
  assert.equal(rq.headers.get("location"), "/cctv?api=reset");
  const rq2 = await fetch(`${base}/settings/?api=reset`, { redirect: "manual" });
  assert.equal(rq2.headers.get("location"), "/settings?api=reset");

  // 1d. 확장자 없는 경로는 200 서빙이 아니라 슬래시 301 — /test 를 그 URL 로 서빙하면
  // 문서 base 가 얕아져 ../web/ 상대 import 가 base 를 탈출한다(페이지 JS 전멸 회귀).
  const rt = await fetch(`${base}/test`, { redirect: "manual" });
  assert.equal(rt.status, 301);
  assert.equal(rt.headers.get("location"), "/test/");
  const rts = await fetch(`${base}/test/`);
  assert.equal(rts.status, 200);
  assert.match(rts.headers.get("content-type"), /text\/html/);

  // 2. /web/ 모듈 — ES 모듈이 text/javascript 로 와야 브라우저가 import 를 받는다
  const mod = await fetch(`${base}/web/api.mjs`);
  assert.equal(mod.status, 200);
  assert.match(mod.headers.get("content-type"), /text\/javascript/);
  assert.match(await mod.text(), /export function fmtPtz/);

  // 3. 광학 모듈은 브라우저에 서빙되지 않는다 — 계산은 백엔드 관문에서만(2026-07-28).
  //    되살아나면 브라우저가 다시 도메인 수식을 갖게 되므로 404 를 계약으로 못박는다.
  assert.equal((await fetch(`${base}/profile/camera-intrinsics.mjs`)).status, 404);

  // 4. 프록시 — /api/* 는 쿼리를 보존한 채 backend 에 도달해야 한다(마운트는 벗긴 뒤)
  const api = await fetch(`${base}/api/version?probe=1`);
  assert.equal(api.status, 200);
  assert.deepEqual(await api.json(), { ok: true, path: "/api/version?probe=1" });
  assert.deepEqual(seen, ["/api/version?probe=1"]);

  // 5. /home-frame/ 도 동적 — 프록시를 타야 한다 (정적 폴백이 가로채면 안 됨)
  await fetch(`${base}/home-frame/cam/p/pt/1`);
  assert.equal(seen[1], "/home-frame/cam/p/pt/1");

  // 6. 경로 탈출 차단 — public 밖(서버 소스 자신)을 읽어가면 안 된다
  const esc = await fetch(`${base}/web/..%2Fserver.mjs`);
  assert.ok([403, 404].includes(esc.status), `탈출이 ${esc.status} 로 통과됨`);

  // 7. base 밖은 404
  assert.equal((await fetch(`${base}/etc/passwd`)).status, 404);

  // 8. stale 프런트 방지 정책 승계 — 정적 응답은 no-cache
  const css = await fetch(`${base}/web/theme.mjs`);
  assert.equal(css.headers.get("cache-control"), "no-cache");
});

test("backend FIN 중도 종료가 클라이언트로 전파된다 (MJPEG 무한 동결 방지)", async (t) => {
  // pm2 restart 의 실제 모양: backend 는 SIGTERM 핸들러가 없어 스트림 도중 소켓이 FIN 으로
  // 닫힌다. 프록시가 이 종료를 res 로 전파하지 않으면(과거 pipe() 회귀) 브라우저 MJPEG <img>
  // 가 에러 이벤트 없이 영구 동결된다 — 유한 시간 안에 본문 읽기가 끝나야(정상이든 에러든) 한다.
  const stub = createServer((req, res) => {
    res.writeHead(200, { "content-type": "multipart/x-mixed-replace; boundary=frame" });
    res.write("--frame\r\ncontent-type: image/jpeg\r\n\r\n");
    setTimeout(() => res.socket.end(), 50); // 프레임 도중 FIN
  });
  stub.listen(0, "127.0.0.1");
  await once(stub, "listening");

  const port = 18000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, [
    serverPath, "--port", String(port), "--backend", `http://127.0.0.1:${stub.address().port}`,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { child.kill(); stub.close(); });
  const base = `http://127.0.0.1:${port}`;
  await until(async () => (await fetch(`${base}/`)).ok);

  const readAll = (async () => {
    const r = await fetch(`${base}/api/stream`);
    try { for await (const _ of r.body) { /* drain */ } return "ended"; }
    catch { return "errored"; }
  })();
  const outcome = await Promise.race([
    readAll,
    new Promise((r) => setTimeout(() => r("HUNG"), 4000)),
  ]);
  assert.notEqual(outcome, "HUNG", "업스트림 FIN 이 클라이언트로 전파되지 않음 — MJPEG 동결 회귀");
});

// 마운트 무관 계약 — 프리픽스는 배포 결정이지 앱의 사실이 아니다. 예전에는 "/barocalory" 가
// 앱 상수로 박혀 있어 다른 마운트·다른 호스트로 옮기면 조용히 어긋났다. --base 로 띄웠을 때
// (1) 문서가 그 프리픽스 아래에서만 열리고 (2) backend 에는 **프리픽스를 벗긴** 경로가
// 도달해야 한다 — backend 는 자기 마운트를 알지 우리 마운트를 모른다.
test("--base 로 마운트를 옮겨도 동작하고, backend 에는 벗긴 경로가 간다", async (t) => {
  const seen = [];
  const stub = createServer((req, res) => {
    seen.push(req.url);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  stub.listen(0, "127.0.0.1");
  await once(stub, "listening");

  const port = 18000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, [
    serverPath, "--port", String(port), "--base", "/mnt",
    "--backend", `http://127.0.0.1:${stub.address().port}`,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { child.kill(); stub.close(); });

  const base = `http://127.0.0.1:${port}`;
  await until(async () => (await fetch(`${base}/mnt/`)).ok);

  // 문서는 마운트 아래에서 열린다
  assert.equal((await fetch(`${base}/mnt/cctv`)).status, 200);
  // 루트는 마운트로 301 — 프리픽스 배포에서 맨손 접속의 착지점
  const root = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(root.status, 301);
  assert.equal(root.headers.get("location"), "/mnt/");
  // 마운트 밖은 404 — 이 서버의 소유 범위가 프리픽스 아래임을 못 박는다
  assert.equal((await fetch(`${base}/cctv`)).status, 404);

  // 핵심: backend 에는 /mnt 가 벗겨진 경로가 도달해야 한다
  await fetch(`${base}/mnt/api/version?probe=1`);
  assert.deepEqual(seen, ["/api/version?probe=1"]);
});
