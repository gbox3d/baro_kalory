import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorPageUrl = new URL("../public/simulator.html", import.meta.url);

test("simulator settings provides a split list/detail CRUD surface", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /class="sim-settings-layout"/);
  assert.match(html, /id="sim-set-list"/);
  assert.match(html, /id="sim-set-add"/);
  assert.match(html, /id="sim-set-id"/);
  assert.match(html, /id="sim-set-name"/);
  assert.match(html, /id="sim-set-type"/);
  assert.match(html, /id="sim-set-save"/);
  assert.match(html, /id="sim-set-delete"/);
  assert.doesNotMatch(html, /id="sim-set-device"/, "the old edit-only device dropdown must stay removed");
});

test("simulator preview shares the first-paint waiting state", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  // preview-stage 는 오버레이 CSS 와 camera-preview 의 closest() 가 함께 보는 표식이다 —
  // 빠뜨리면 이 페이지만 대기/정지 오버레이 없이 깨진 이미지 아이콘을 그린다.
  assert.match(html, /id="stage" class="preview-stage preview-waiting"/);
  assert.match(html, /id="view" class="preview-waiting-image"/);
});

test("simulator PTZ overlay uses the shared overlay behavior", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /id="ptz-overlay" class="ptz-control-overlay"/);
  assert.match(html, /id="sim-ptz-mount" class="ptz-controls-mount"/);
  assert.match(html, /overlay:\s*\{[\s\S]*?container: ptzOverlay/);
  assert.doesNotMatch(html, /function updatePtzOverlayVisibility/);
  assert.doesNotMatch(html, /sim-abs-ptz-card/);
});

test("simulator page uses server-owned simulator CRUD and forces sim mode", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /getJson\(api\("\/simulator\/devices"\)\)/);
  assert.match(html, /reqJson\(creating \? "POST" : "PATCH", url, updated\)/);
  assert.match(html, /reqJson\("DELETE", api\(`\/simulator\/devices\//);
  assert.match(html, /mode: "sim"/);
  assert.doesNotMatch(html, /postJson\(api\("\/cctv\/config"\)/);
});

test("simulator camera selection and control stay isolated from CCTV active state", async () => {
  const [html, controls] = await Promise.all([
    readFile(simulatorPageUrl, "utf8"),
    readFile(new URL("../src/ptz-controls.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(html, /SIM_ACTIVE_CAMERA_KEY = "sim:active-camera\.v1"/);
  assert.match(html, /postJson\(api\("\/simulator\/active"\)/);
  assert.match(html, /apiBase: api\("\/simulator\/control"\)/);
  assert.match(html, /streamUrl: api\("\/simulator\/stream"\)/);
  assert.match(html, /snapshotUrl: api\("\/simulator\/control\/snapshot"\)/);
  assert.doesNotMatch(html, /postJson\(api\("\/cctv\/active"\)/);
  assert.match(controls, /apiBase = api\(""\)/);
  assert.match(controls, /`\$\{apiBase\}\/ptz\/nudge`/);
});

test("simulator camera switch refreshes scene data for the selected simulator", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /function simulatorSceneKey\(/);
  assert.match(html, /function invalidateSimulatorScene\(/);
  assert.match(html, /simCatalog = null/);
  assert.match(html, /getJson\(api\("\/simulator\/catalog"\)\)/);
  assert.match(html, /getJson\(api\("\/simulator\/slots"\)\)/);
  assert.match(html, /getJson\(api\("\/simulator\/cars"\)\)/);
  assert.match(html, /await Promise\.all\(\[\s*loadPtz\(\),\s*refreshCameraPose\(\),\s*loadSimulator\(\),\s*refreshSimulatorStatus\(\{ silent: true \}\),?\s*\]\)/);
});

test("simulator overlay asks the backend for pin coordinates — no optics in the browser", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  // 2026-07-28: 투영 수식은 백엔드 관문에만 있다. 브라우저가 광학 모듈을 다시 import 하면
  // 계산 지점이 둘로 갈라져 모델이 조용히 어긋난다 — 그 회귀를 여기서 막는다.
  assert.doesNotMatch(html, /from "\.\/profile\//);
  assert.doesNotMatch(html, /projectWorldToPixel|ptzCamera/);
  assert.match(html, /postJson\(api\("\/simulator\/overlay"\)/);
  // 선택·필터 변경은 캐시된 좌표로 다시 그린다(네트워크 왕복 없음).
  assert.match(html, /function renderPins\(\)/);
});

test("리그 갱신은 활성 카메라가 갈리면 PTZ 와 핀을 다시 읽는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  // 보고 있던 카메라를 지우면 서버가 활성 sim 기기를 스스로 갈아 끼운다. 프리뷰는 스트림이
  // 끊긴 자리에서 새 카메라로 재연결하는데, PTZ 표시와 핀만 옛 카메라 것으로 남으면
  // 새 카메라의 영상 위에 남의 주차면 핀이 얹힌다.
  const start = html.indexOf("async function refreshRig()");
  const end = html.indexOf("async function saveSceneSnapshot()", start);
  const refresh = html.slice(start, end);
  assert.match(refresh, /const activeBefore = simActiveCameraId/);
  assert.match(refresh, /simActiveCameraId !== activeBefore/);
  assert.match(refresh, /lastPtz = null/);
  assert.match(refresh, /await loadPtz\(\)/);
});

test("세우기가 실패해도 리그를 다시 읽는다 — 롤백까지 실패하면 카메라가 씬에 남는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  // 백엔드는 등록 실패 시 카메라를 되돌리고, 되돌리는 것마저 실패하면 rolledBack:false 로
  // 알린다. 그때 목록을 갱신하지 않으면 그 카메라는 화면 어디에도 없는 채 포트만 물고
  // 있어, 다음 세우기를 영문 모를 포트 충돌로 막는다.
  const start = html.indexOf("async function spawnSceneCamera(");
  const end = html.indexOf("async function removeSceneCamera(", start);
  const spawn = html.slice(start, end);
  assert.match(spawn, /e\.body\?\.rolledBack === false/);
  assert.match(spawn, /catch \(e\) \{[\s\S]*await refreshRig\(\)/);
});

test("simulator list rendering uses textContent for config-provided values", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const start = html.indexOf("function renderSimDeviceList()");
  const end = html.indexOf("function fillSimDeviceForm()", start);
  const render = html.slice(start, end);
  assert.match(render, /name\.textContent =/);
  assert.match(render, /meta\.textContent =/);
  assert.doesNotMatch(render, /innerHTML/);
});
