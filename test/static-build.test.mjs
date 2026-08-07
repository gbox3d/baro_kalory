// 재작성 규칙 없는 정적 호스트(GitHub Pages·S3·CDN) 배포 계약.
//
// 이 파일이 지키는 것은 두 가지다.
//   (1) 페이지 목록 미러가 갈라지지 않는 것 — 정적 호스트에서 미러 하나는 곧 404 다.
//   (2) 정적 빌드 판정이 **디렉터리 URL 에서도** 맞는 것. Pages 는 index.html 을 `/<repo>/`
//       로 서빙해서 pathname 이 ".html" 로 끝나지 않는다. 대문에서만 나는 그 오판은 링크
//       404 로 끝나지 않고, 미연결 게이트가 href 비교로 설정 카드를 가리므로 설정 카드까지
//       잠근다 — 백엔드 주소를 넣을 유일한 문이 잠겨 첫 방문이 벽돌이 된다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PAGE_FILES, STATIC_MARKER, rewriteForStaticHost } from "../pack.mjs";
import { PAGES, pageHref, isStaticBuild } from "../src/pages.mjs";

const repo = new URL("../", import.meta.url);

// isStaticBuild() 는 브라우저 전역을 읽는다. 노드에서 그 두 값만 흉내 내 판정을 검사한다.
function withDom({ pathname, marker }, fn) {
  const prevDoc = globalThis.document;
  const prevLoc = globalThis.location;
  globalThis.document = { querySelector: (sel) => (marker && sel.includes("baro-static-build") ? {} : null) };
  globalThis.location = { pathname };
  try { return fn(); } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc;
  }
}

test("dist 페이지 목록은 pages.mjs 에서 파생된다 — 손으로 베낀 미러가 아니다", async () => {
  assert.deepEqual(PAGE_FILES, PAGES.map((p) => (p.slug ? `${p.slug}.html` : "home.html")));
  for (const f of PAGE_FILES) {
    await readFile(new URL(`public/${f}`, repo)); // 없으면 여기서 던진다
  }
});

test("정적 호스트 재작성: 확장자 없는 링크와 / 진입을 실파일로 바꾼다", () => {
  const html = '<head></head><a href="./">홈</a><a href="./cctv">CCTV</a><a href="./settings">설정</a>';
  const out = rewriteForStaticHost(html);
  assert.match(out, /href="\.\/index\.html"/);
  assert.match(out, /href="\.\/cctv\.html"/);
  assert.match(out, /href="\.\/settings\.html"/);
  assert.doesNotMatch(out, /href="\.\/(cctv|settings)"/);
});

test("재작성은 정적 빌드 표식을 심고, 두 번 돌려도 하나뿐이다", () => {
  const once = rewriteForStaticHost("<head></head><body></body>");
  assert.ok(once.includes(STATIC_MARKER));
  const twice = rewriteForStaticHost(once);
  assert.equal(twice.match(/name="baro-static-build"/g).length, 1);
});

test("표식을 심을 자리가 없으면 조용히 넘기지 않고 던진다", () => {
  // 표식 없이 배포되면 대문이 벽돌이 된다 — 실패는 빌드에서 나야지 브라우저에서 나면 안 된다.
  assert.throws(() => rewriteForStaticHost("<body>머리 없는 페이지</body>"), /baro-static-build|head/i);
});

test("정적 빌드 판정: 표식이 있으면 디렉터리 URL(`/<repo>/`)에서도 정적이다", () => {
  assert.equal(withDom({ pathname: "/baro_kalory/", marker: true }, isStaticBuild), true);
  assert.equal(withDom({ pathname: "/", marker: true }, isStaticBuild), true);
  // 표식이 없으면 개발 서버(라우팅 있음)다 — 확장자 없는 정규형 링크를 쓴다.
  assert.equal(withDom({ pathname: "/baro_kalory/", marker: false }, isStaticBuild), false);
  assert.equal(withDom({ pathname: "/cctv", marker: false }, isStaticBuild), false);
  // 소스 트리를 그대로 연 경우는 표식이 없어도 실파일 링크여야 한다.
  assert.equal(withDom({ pathname: "/public/cctv.html", marker: false }, isStaticBuild), true);
});

test("게이트의 설정 판정이 대문 카드의 href 와 일치한다 (설정 카드 잠금 회귀)", async () => {
  // page-chrome 의 showBackendGate 는 `a.home-card` 중 href 가 pageHref("settings") 와
  // 다른 것을 전부 잠근다. 대문 카드는 pack 이 재작성하므로, 판정이 URL 추측이면 대문에서만
  // 둘이 어긋나 설정 카드가 잠기고 주소를 넣을 길이 사라진다.
  const home = rewriteForStaticHost(await readFile(new URL("public/home.html", repo), "utf8"));
  const href = withDom({ pathname: "/baro_kalory/", marker: true }, () => pageHref("settings"));
  assert.ok(home.includes(`href="${href}"`), `대문 카드에 ${href} 가 없다 — 게이트가 설정 카드를 잠근다`);
  assert.equal(href, "./settings.html");
});

test("정적 빌드에서 홈 링크는 index.html 을 가리킨다 (디렉터리 URL 404 회귀)", () => {
  assert.equal(withDom({ pathname: "/baro_kalory/cctv.html", marker: true }, () => pageHref("home")), "./index.html");
  assert.equal(withDom({ pathname: "/cctv", marker: false }, () => pageHref("home")), "./");
});
