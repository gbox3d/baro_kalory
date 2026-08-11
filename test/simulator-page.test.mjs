import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorPageUrl = new URL("../public/simulator.html", import.meta.url);

// 설정 탭에는 **시뮬레이터 주소 하나뿐**이다.
//
// 카메라 목록을 여기 두지 않는 이유: 같은 목록이 이미 두 군데 있다(위쪽 카메라 피커,
// 「카메라 배치」 탭의 목록). 설정 탭에 세 번째 사본을 두면 아무 힘도 없는 목록 하나가
// 늘 뿐이고 — 읽기 전용이라 고칠 수도 없고 클릭은 위 피커로 위임했다 — 320px 칸을 넘겨
// 내용이 잘렸다(실측 203px). 옛 기기 CRUD 창이 있던 자리를 채우려다 만든 사본이었다.
test("설정 탭은 시뮬레이터 주소 하나뿐이다 — 목록 사본을 두지 않는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const panel = html.slice(
    html.indexOf(`id="sim-settings-panel"`),
    html.indexOf("<!-- 우: 씬 셋업 -->"),
  );
  assert.ok(panel.length > 200, "설정 패널을 못 읽었다");
  assert.match(panel, /id="sim-endpoint-host"/);
  for (const id of ["sim-set-list", "sim-set-status", "sim-set-add", "sim-set-id",
                    "sim-set-save", "sim-set-delete"]) {
    assert.doesNotMatch(panel, new RegExp(`id="${id}"`), `${id} 는 기기 CRUD 시절의 잔재다`);
  }
  assert.doesNotMatch(html, /sim-settings-layout|sim-device-detail\b/, "편집 창이 붙던 레이아웃도 함께 사라진다");

  // 넘치면 스크롤한다. overflow:hidden 이면 스크롤바도 없이 잘려서, 잘린 줄 모른다.
  assert.doesNotMatch(html, /#sim-settings-panel,\s*\n#sim-rig-panel \{\s*\n\s*overflow: hidden/);
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

// 씬이 준 이름·라벨을 그리는 유일한 목록이다. innerHTML 로 붙이면 씬의 문자열이 곧 마크업이 된다.
test("카메라 목록은 씬이 준 값을 textContent 로 그린다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  const start = html.indexOf("function renderSceneCameraList()");
  const end = html.indexOf("async function startCameraEdit(", start) > 0
    ? html.indexOf("async function startCameraEdit(", start)
    : html.indexOf("function startCameraEdit(", start);
  const render = html.slice(start, end);
  assert.ok(render.length > 200, "목록 렌더러를 못 읽었다");
  assert.match(render, /\.textContent =/);
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

  // 자리(x·y)는 이 폼이 아니라 평면도에서 끌어 옮긴다. 두 자리에서 같은 것을 고치면
  // 어느 쪽이 이겼는지가 화면에 안 보인다.
  const drag = html.slice(html.indexOf("function beginCameraDrag("), html.indexOf("if (mapEl) {"));
  assert.ok(drag.length > 400, "드래그 이동 코드를 못 읽었다");
  // 씬은 손을 뗄 때 한 번만 바뀐다 — 끄는 동안 PATCH 를 흘리면 프레임마다 액터가 움직이고
  // 중간에 실패하면 카메라가 어디에 있는지 아무도 모른다.
  assert.equal(drag.match(/reqJson\("PATCH"/g)?.length, 1);
  // 높이는 그대로 되돌려보낸다. 자리만 옮겼는데 설치 높이가 조용히 달라지면 안 된다.
  assert.match(drag, /location: \{ x: to\.x, y: to\.y, z: drag\.from\.z \}/);
  // 안 움직였으면 그냥 클릭(선택)이다.
  assert.match(drag, /if \(!drag\.moved\) \{ selectSceneCamera\(drag\.cam\.id\); return; \}/);
  // 레벨 저작 카메라는 옮길 수 없다(백엔드 403).
  assert.match(drag, /drag\.cam\.spawned === false/);
  // 실패해도 씬이 정본이다.
  assert.match(drag, /finally \{[\s\S]*await refreshRig\(\)/);

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
  // 끄는 중에 지도를 다시 만들면 끌던 것이 손 아래에서 사라진다.
  assert.match(poll, /placing \|\| dragCam \|\| editingCameraId \|\| busyEl\.textContent/);
  // 바뀐 게 없으면 그리지 않는다(스크롤·커서 튐 방지).
  assert.match(poll, /if \(rigSignature\(\) === before\) return;/);
  // 등록부는 주기 호출 대상이 아니다 — loadCameras 는 활성 기기를 서버에 쓴다.
  assert.doesNotMatch(poll, /loadCameras\(/);
});

// 시뮬레이터 주소는 카메라와 별개다 — 카메라를 전부 지워도 연결이 남아야 한다.
// 회귀(2026-08-11): 주소가 카메라 기기의 scenePort 에 얹혀 있어서, 기기를 전부 지우자
// 백엔드가 인메모리 더블로 내려가고 화면이 실제 주차장 대신 빈 씬을 그렸다.
test("주소는 카메라가 아니라 시뮬레이터(월드)의 것이다 — 자기 화면과 자기 라우트를 갖는다", async () => {
  const html = await readFile(simulatorPageUrl, "utf8");
  // 계정도 월드의 것이다 — 카메라마다 복사돼 있던 것을 이 한 자리로 모았다.
  for (const id of ["sim-endpoint-host", "sim-endpoint-port", "sim-endpoint-timeout",
                    "sim-endpoint-user", "sim-endpoint-pass",
                    "sim-endpoint-probe", "sim-endpoint-save", "sim-endpoint-status"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  assert.match(html, /getJson\(api\("\/simulator\/endpoint"\)\)/, "시뮬레이터 주소를 읽어 와야 한다");
  assert.match(html, /reqJson\("PUT", api\("\/simulator\/endpoint"\)/, "주소는 PUT 으로 저장한다");
  // 기기 편집 폼은 제어 포트를 보내지 않는다 — 백엔드가 400 으로 거절한다.
  assert.doesNotMatch(html, /id="sim-set-sceneport"/);
  // 옛 이름을 값으로 다루는 곳이 없어야 한다(주석에 이름이 나오는 것은 내력 설명이라 무해).
  // 남아 있으면 그 이름으로 보낸 저장이 백엔드에서 400 으로 끊긴다 — 조용히 무시했다면
  // "포트 없음" = **해제**로 읽혀 시뮬레이터 주소가 통째로 지워졌을 값이다.
  assert.doesNotMatch(html, /\bscenePort\b\s*[:.=]|\.scenePort\b/);
  assert.match(html, /controlPort/, "제어 포트는 시뮬레이터 하나의 것이다");

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
