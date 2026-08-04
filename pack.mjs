#!/usr/bin/env node
// CDN/정적 호스팅용 팩 — dist/ 한 폴더에 UI 전체를 모은다 (번들링 없음, 파일 배치만).
//
//   pnpm --filter @baro/frontend build:dist   # build:css 후 dist/ 생성 (pack 은 pnpm 예약어)
//
// dist/ 를 GitHub Pages·CDN·아무 정적 서버에나 올리면 된다. 페이지가 전부 상대경로라
// 마운트 프리픽스(/repo/, /barocalory/, /)가 무엇이든 동작하고, backend 는 설정 탭
// 또는 <meta name="baro-api-base"> 주입으로 지정한다(동일 출처에 backend 가 없으므로
// CDN 배포에서는 지정이 필수 — backend 쪽 config.cors.origins 도 열어야 한다).
//
// 배치 규약(웹 URL 공간과 동일):
//   dist/            = public/*  (페이지 HTML·app.css·favicon·test·_compare)
//   dist/web/        = src/*.mjs (테스트 제외 — 브라우저 모듈)

import { cpSync, rmSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");

if (!existsSync(join(here, "public", "app.css"))) {
  console.error("public/app.css 가 없습니다 — 먼저 build:css (pnpm --filter @baro/frontend build)");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(join(here, "public"), dist, { recursive: true });

// ── 일반 정적 호스트 호환 재작성 (리뷰 확정 결함 반영) ─────────────────────────
// 소스의 페이지 링크(./ ·./cctv)와 진입점(home.html)은 nginx/server.mjs 의 페이지 라우팅이
// 있어야 성립한다. S3·기본 nginx·python http.server 같은 재작성 규칙 없는 호스트에선
// 확장자 없는 URL 도, index 없는 / 진입도 404 다. dist 에서만: home.html 을 index.html 로
// 복제하고 페이지 링크를 .html 실파일로 재작성한다(소스는 무변경 — URL 정규형 유지).
for (const page of ["home.html", "cctv.html", "discovery.html", "simulator.html", "settings.html", "calibration.html"]) {
  const p = join(dist, page);
  let s = readFileSync(p, "utf8");
  s = s.replace(/href="\.\/"(?=[ >])/g, 'href="./index.html"');
  s = s.replace(/href="\.\/(cctv|discovery|simulator|settings|calibration)"/g, 'href="./$1.html"');
  writeFileSync(p, s);
}
writeFileSync(join(dist, "index.html"), readFileSync(join(dist, "home.html")));

mkdirSync(join(dist, "web"), { recursive: true });
for (const f of readdirSync(join(here, "src"))) {
  if (!f.endsWith(".mjs") || f.endsWith(".test.mjs")) continue;
  cpSync(join(here, "src", f), join(dist, "web", f));
}

const count = (d) => readdirSync(d, { recursive: true }).length;
console.log(`dist/ 생성: ${count(dist)}개 항목 (web ${readdirSync(join(dist, "web")).length})`);
