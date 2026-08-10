import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webUiDir = new URL("../", import.meta.url);

const APPS = ["calibration", "cctv", "discovery", "height", "settings", "simulator"];

test("각 프런트 앱은 자기 버전을 독립적으로 든다", async () => {
  // public/ 에 있는 이유: 이 파일은 페이지와 **함께 배포**되어야 한다(2026-07-28). 페이지가
  // 자기 버전을 여기서 읽으므로, 프런트를 CDN 등에 따로 올려도 표시가 실제와 일치한다.
  const versions = JSON.parse(await readFile(new URL("public/app-versions.json", webUiDir), "utf8"));
  // The point is that each front-end carries its OWN version — not what those versions
  // happen to be today. Pinning the literals here would fail on every legitimate bump, which
  // trains everyone to update the test without reading it.
  assert.deepEqual(Object.keys(versions).sort(), APPS);
  for (const [app, v] of Object.entries(versions)) {
    assert.match(v, /^\d+\.\d+\.\d+$/, `${app} must carry a semver`);
  }
});

test("페이지는 공용 크롬을 부르고, backend 가 프런트 버전을 대신 읽어 주지 않는다", async () => {
  // 버전 표시는 page-chrome.mjs 로 일원화됐다(2026-08-03 4앱 분리). 각 페이지는
  // initPageChrome({ page: "<id>" }) 를 부르고, 모듈이 app-versions.json 을 읽는다.
  const pages = [
    ["cctv", "public/cctv.html"],
    ["discovery", "public/discovery.html"],
    ["simulator", "public/simulator.html"],
    ["settings", "public/settings.html"],
    ["calibration", "public/calibration.html"],
    ["height", "public/height.html"],
    ["home", "public/home.html"],
  ];
  for (const [name, rel] of pages) {
    const html = await readFile(new URL(rel, webUiDir), "utf8");
    assert.match(html, new RegExp(`initPageChrome\\(\\{ page: "${name}" \\}\\)`), `${name} 는 공용 크롬을 불러야 한다`);
    assert.match(html, /data-role="chrome"/, `${name} 헤더에 크롬 마운트가 없다`);
    // backend 응답의 프런트 버전 필드에 의존하면 따로 배포한 순간 값이 어긋난다.
    assert.doesNotMatch(html, /v\.cctvVersion|v\.simulatorVersion|v\.frontendVersion/, `${name} 잔여 의존`);
  }
});

test("page-chrome 은 버전 파일을 모듈 URL 기준으로 읽는다 (/web/ 404 함정)", async () => {
  const chrome = await readFile(new URL("src/page-chrome.mjs", webUiDir), "utf8");
  // fetch("./app-versions.json") 은 모듈 URL(/barocalory/web/) 기준으로 풀려 404 가 된다 —
  // 반드시 import.meta.url 에서 한 단계 올라가야 페이지 루트에 닿는다.
  assert.match(chrome, /new URL\("\.\.\/app-versions\.json", import\.meta\.url\)/);
  assert.doesNotMatch(chrome, /fetch\("\.\/app-versions\.json"\)/);
});

test("home 카드는 모든 앱을 가리키고 각자의 버전 키를 단다", async () => {
  const home = await readFile(new URL("public/home.html", webUiDir), "utf8");
  for (const app of APPS) {
    assert.match(home, new RegExp(`data-version-key="${app}"`), `${app} 버전 배지 누락`);
  }
  for (const slug of ["cctv", "discovery", "simulator", "settings", "calibration", "height"]) {
    assert.match(home, new RegExp(`href="\\./${slug}"`), `${slug} 카드 링크 누락`);
  }
});
