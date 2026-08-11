import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorPageUrl = new URL("../public/simulator.html", import.meta.url);

// 설정 탭에는 두 가지뿐이다: 월드(씬 주소·계정) 하나와, 그 씬에서 파생된 읽기 전용 카메라 목록.
// 카메라를 등록하는 창은 없다 — 그 등록이 씬의 그림자 사본이 되어 반드시 어긋났기 때문이다.
test("설정 탭은 월드 하나와 씬에서 온 읽기 전용 목록뿐이다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /id="sim-set-list"/);
  for (const id of ["sim-set-add", "sim-set-id", "sim-set-name", "sim-set-type",
                    "sim-set-save", "sim-set-delete", "sim-set-cancel", "sim-set-device"]) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `${id} 는 기기 CRUD 의 잔재다`);
  }
  assert.doesNotMatch(html, /sim-settings-layout|sim-device-detail\b/, "편집 창이 붙던 레이아웃도 함께 사라진다");
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

test("카메라 목록은 읽기만 한다 — 만들고 지우는 자리는 /simulator/cameras 다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /getJson\(api\("\/simulator\/devices"\)\)/);
  // 백엔드가 405 로 답하는 경로다. 화면에 남아 있으면 저장 버튼이 조용히 실패한다.
  assert.doesNotMatch(html, /"(POST|PATCH|DELETE)", api\(`?\/simulator\/devices/);
  // 씬을 고치는 자리는 카메라 라우트 하나다.
  assert.match(html, /reqJson\("PATCH", api\(`\/simulator\/cameras\//);
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

test("세우기는 씬만 건드린다 — 기기를 따로 만들지 않고, 실패해도 리그를 다시 읽는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const start = html.indexOf("async function spawnSceneCamera(");
  const end = html.indexOf("async function removeSceneCamera(", start);
  const spawn = html.slice(start, end);
  // 기기 등록이라는 단계가 없어졌다. `register` 를 실어 보내면 받는 쪽이 없는 값을 보내는
  // 것이고, 이름 칸은 사람이 적은 값이 아무 데도 안 가는 죽은 입력이 된다.
  assert.doesNotMatch(spawn, /register/);
  assert.doesNotMatch(spawn, /rolledBack/, "되돌릴 등록이 없으므로 롤백 분기도 없다");
  // 실패해도 씬은 바뀌었을 수 있다 — 화면을 씬으로 되맞춘다.
  assert.match(spawn, /catch \(e\) \{[\s\S]*await refreshRig\(\)/);
});

test("simulator list rendering uses textContent for config-provided values", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const start = html.indexOf("function renderSimDeviceList()");
  const end = html.indexOf("function selectSimulatorCamera(", start);
  const render = html.slice(start, end);
  assert.match(render, /name\.textContent =/);
  assert.match(render, /meta\.textContent =/);
  assert.doesNotMatch(render, /innerHTML/);
});

test("세워 둔 카메라의 설치를 고칠 수 있다 — 높이는 지면 기준, 좌표는 씬이 준 그대로", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  assert.match(html, /id="sim-cam-edit-form"/);
  assert.match(html, /id="sim-cam-edit-height"/);
  // 하향각은 씬이 주지 않는 값이라(PTZ tilt) 비워 두는 것이 "그대로"여야 한다. 추측을 폼에
  // 채워 두면 손대지 않은 칸이 카메라를 돌린다.
  assert.match(html, /id="sim-cam-edit-pitch"[^>]*placeholder="그대로"/);

  const start = html.indexOf("async function applyCameraEdit(");
  const end = html.indexOf("async function spawnSceneCamera(", start);
  assert.ok(start > 0 && end > start, "편집 적용 함수가 있어야 한다");
  const apply = html.slice(start, end);
  // 지면을 모르면 세우지 않는 것과 같은 이유로 옮기지도 않는다 — 0 으로 가정하면 지면이
  // z=0 이 아닌 레벨에서 그 차이가 통째로 높이 오차가 된다.
  assert.match(apply, /sceneGroundZcm\(\)/);
  assert.match(apply, /ground === null/);
  // x·y 는 씬이 준 값 그대로. 축 하나만 보내면 나머지를 sim 이 0 으로 읽어 카메라가 원점으로 간다.
  assert.match(apply, /patch\.location = \{ x, y, z: heightM \* 100 \+ ground \}/);
  assert.match(apply, /reqJson\("PATCH", api\(`\/simulator\/cameras\//);
  // 씬이 정본이다 — 실패해도 일부는 반영됐을 수 있으므로 화면을 씬으로 되맞춘다.
  assert.match(apply, /catch \(e\) \{[\s\S]*await refreshRig\(\)/);

  // 레벨에 저작된 카메라는 옮길 수 없다 — 삭제와 같은 자리에서 함께 가려야 한다.
  const listStart = html.indexOf("function renderSceneCameraList()");
  const listEnd = html.indexOf("async function startCameraEdit(", listStart) > 0
    ? html.indexOf("async function startCameraEdit(", listStart)
    : html.indexOf("function startCameraEdit(", listStart);
  const list = html.slice(listStart, listEnd);
  assert.match(list, /if \(cam\.spawned !== false\) \{[\s\S]*startCameraEdit\(cam\)/);
});

test("카메라 배치 목록은 씬을 주기적으로 다시 읽되, 바뀐 게 없으면 다시 그리지 않는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const start = html.indexOf("async function pollRig()");
  const end = html.indexOf("setInterval(", start);
  assert.ok(start > 0 && end > start, "주기 갱신 함수가 있어야 한다");
  const poll = html.slice(start, end);
  // 안 보는 탭이 시뮬 게임스레드를 계속 깨우면 안 된다.
  assert.match(poll, /document\.hidden \|\| !rigTabVisible\(\)/);
  // 사람이 배치·편집 중이거나 조작이 도는 중에는 목록을 다시 만들지 않는다 — setBusy 가
  // 모든 버튼의 disabled 를 되돌리므로 잠가 둔 버튼이 되살아난다.
  assert.match(poll, /placing \|\| editingCameraId \|\| busyEl\.textContent/);
  // 바뀐 게 없으면 그리지 않는다(스크롤·커서 튐 방지).
  assert.match(poll, /if \(rigSignature\(\) === before\) return;/);
  // 등록부는 주기 호출 대상이 아니다 — loadCameras 는 활성 기기를 서버에 쓴다.
  assert.doesNotMatch(poll, /loadCameras\(/);
});

// 씬 주소는 카메라와 별개다 — 카메라를 전부 지워도 시뮬 연결이 남아야 한다.
// 회귀(2026-08-11): 주소가 카메라 기기의 scenePort 에 얹혀 있어서, 기기를 전부 지우자
// 백엔드가 인메모리 더블로 내려가고 화면이 실제 주차장 대신 빈 씬을 그렸다.
test("씬 주소는 카메라가 아니라 월드의 것이다 — 자기 화면과 자기 라우트를 갖는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  // 계정도 월드의 것이다 — 카메라마다 복사돼 있던 것을 이 한 자리로 모았다.
  for (const id of ["sim-endpoint-host", "sim-endpoint-port", "sim-endpoint-timeout",
                    "sim-endpoint-user", "sim-endpoint-pass",
                    "sim-endpoint-probe", "sim-endpoint-save", "sim-endpoint-status"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  assert.match(html, /getJson\(api\("\/simulator\/endpoint"\)\)/, "씬 주소를 읽어 와야 한다");
  assert.match(html, /reqJson\("PUT", api\("\/simulator\/endpoint"\)/, "씬 주소는 PUT 으로 저장한다");
  // 기기 편집 폼은 더 이상 씬 포트를 보내지 않는다 — 백엔드가 400 으로 거절한다.
  assert.doesNotMatch(html, /id="sim-set-sceneport"/);
  assert.doesNotMatch(html, /scenePort: selected\.scenePort/);

  // 빈 비밀번호 칸은 "모른다"이지 "지워라"가 아니다. 빈 문자열을 실어 보내면 호스트만
  // 고치는 저장 한 번에 월드의 계정이 사라지고 모든 파생 카메라가 인증에 실패한다.
  const start = html.indexOf("function readEndpointForm()");
  const form = html.slice(start, html.indexOf("async function loadSceneEndpoint(", start));
  assert.match(form, /\.\.\.\(password \? \{ password \} : \{\}\)/);
});

// JS 가 부르는 element id 는 전부 DOM 에 있어야 한다. getElementById(...).disabled 처럼
// 곧바로 속성을 쓰는 자리가 많아, 없는 id 가 하나만 남아도 그 탭이 통째로 죽는다 —
// 입력칸을 지우면서 참조를 안 고쳐 실제로 그랬다(2026-08-11).
test("화면이 부르는 element id 는 전부 실재한다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const referenced = new Set([...html.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]));
  const present = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(referenced.size > 50, "참조를 못 읽었다");
  assert.deepEqual([...referenced].filter((id) => !present.has(id)), []);
});
