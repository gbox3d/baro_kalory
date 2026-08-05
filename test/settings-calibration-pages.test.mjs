import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("설정 페이지 — DOM 계약과 부트스트랩", async () => {
  const html = await read("../public/settings.html");
  // 각 탭이 소유한 요소 — 하나라도 빠지면 이식 중 유실된 것이다.
  for (const id of [
    "set-current",                                                              // 기기 탭: 현재 연결
    "dev-active", "dev-list", "set-cam-id", "dev-name", "dev-type", "dev-mode",  // 기기 탭: 목록·폼
    "dev-host-fields", "set-cam-host", "set-cam-port", "set-cam-user", "set-cam-pass",
    "dev-scheme", "dev-advanced", "dev-rtsp-path", "dev-rtsp-port", "dev-stream-fps",
    "dev-mjpeg-port", "dev-scene-port", "dev-timeout", "dev-insecure-tls",
    "dev-fwmodid", "dev-portid", "dev-ptzportid", "dev-streamindex",
    "dev-vptz", "dev-vptz-on", "dev-vptz-hfov", "dev-vptz-maxmag", "dev-vptz-w", "dev-vptz-h",
    "dev-add", "dev-save", "dev-del", "dev-cancel", "set-probe",                // 기기 탭: 조작 한 줄
    "dev-editor", "dev-edit-title", "dev-msg", "set-probe-out",
    "apibase-input", "apibase-save", "apibase-clear", "apibase-status",         // 서버 탭: API 서버
    "st-backend", "st-camera", "st-detector", "st-lpr", "set-refresh-status",   // 서버 탭: 서비스 상태
    "set-detector", "set-probe-det", "set-det-out",                             // 검출·판독 탭: 검출기
    "set-lpr", "set-probe-lpr", "set-lpr-out",                                  // 검출·판독 탭: LPR
    "set-key-anthropic", "set-key-openai", "set-key-hint",                      // 검출·판독 탭: API 키
    "set-save", "set-save-out",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  assert.match(html, /loadCctvSettings\(\);/, "부트에서 설정을 로드해야 한다");
  // 탭 — 설정을 한 줄로 늘어놓지 않는다. 버튼과 패널은 짝이 맞아야 한다(한쪽만 고치면
  // 눌리지 않는 탭 또는 열 수 없는 패널이 남는다).
  for (const name of ["devices", "server", "detect"]) {
    assert.match(html, new RegExp(`data-tab="${name}"`), `탭 버튼 ${name} 누락`);
    assert.match(html, new RegExp(`data-panel="${name}"`), `탭 패널 ${name} 누락`);
  }
  assert.match(html, /function showTab\(/, "탭 전환기가 있어야 한다");

  // 기기 CRUD 는 그 자리에서 서버에 반영된다. 예전에는 확정 버튼이 브라우저 배열만 고치고
  // 화면 밖 맨 아래 '저장'을 따로 눌러야 했는데, 그 버튼 이름이 '적용'이라 누른 사람은
  // 저장된 줄 알고 나갔다. 바로 옆 활성 기기 드롭다운은 즉시 반영이라 규칙도 섞여 있었다.
  assert.doesNotMatch(html, /id="dev-apply"/, "'이 기기 적용'은 아무것도 확정하지 않던 버튼이다");
  assert.match(html, /async function commitDevices\([\s\S]{0,400}postJson\(api\("\/cctv\/config"\)/,
    "기기 변경은 그 자리에서 서버로 가야 한다");
  // 삭제는 되돌릴 수 없고 즉시 반영된다 — 목록에서 사라지는 것만으로는 그 사실이 전달되지 않는다.
  assert.match(html, /confirm\(t\("기기 '\{id\}' 를 삭제합니다/, "삭제는 확인을 받아야 한다");
  // 작성 취소는 '삭제'가 겸하지 않는다 — 그만두려는 사람에게 삭제밖에 없는 화면이었다.
  assert.match(html, /function cancelEditor\(/, "취소는 삭제와 별개 조작이어야 한다");

  // 하단 저장은 자기 탭(검출기·LPR·키)만 보낸다. 기기까지 실어 보내면 즉시 반영과 두 벌이 되고,
  // 화면에서 지운 기기가 이 경로로 되살아난다.
  const saveHandler = html.slice(html.indexOf('getElementById("set-save")'));
  assert.doesNotMatch(saveHandler.slice(0, 1200), /devices:/,
    "이 탭 저장은 기기 목록을 보내지 않아야 한다");

  // 목록 행 자체가 선택이다 — 행마다 붙던 '편집' 버튼은 이름이 길면 세로로 찌그러졌다.
  assert.match(html, /row\.onclick = \(\) => selectDevice\(x\.id\)/, "행을 누르면 선택되어야 한다");
  assert.match(html, /dev-name[\s\S]{0,600}dev-meta/, "행 정보는 이름·식별자·주소로 나뉘어야 한다");
  assert.match(html, /#dev-list[^}]*overflow-y: auto/, "기기 목록은 높이를 제한하고 스크롤해야 한다");

  // 기기 탭은 2단이다 — 왼쪽 목록, 오른쪽 편집. 두 단은 각자 스크롤한다(목록을 훑는 동안
  // 편집 중인 폼이 함께 밀려 올라가면 안 된다).
  assert.match(html, /section\[data-panel="devices"\][^}]*flex-direction: row/, "기기 탭은 2단이어야 한다");
  assert.match(html, /\.dev-card-list[^}]*min-height: 0/, "목록 단은 자기 안에서 스크롤해야 한다");
  assert.match(html, /\.dev-col-edit[^}]*overflow-y: auto/, "편집 단은 따로 스크롤해야 한다");

  // 접속 옵션은 전부 편집기가 다뤄야 한다. 프론트가 못 채우는 필드가 있으면 그 기기는
  // "연결 테스트는 통과하는데 화면은 안 나오는" 상태로 등록된다(IDIS 실기에서 그대로 겪었다:
  // scheme 이 없어 평문 포트에 TLS, rtspPath 가 없어 프리뷰 501).
  for (const key of ["scheme", "mjpegPort", "scenePort", "timeoutMs", "rtspPath", "rtspPort",
                     "streamFps", "insecureTls", "fwModId", "portId", "ptzPortId", "streamIndex"]) {
    assert.match(html, new RegExp(`DEV_CONN_KEYS[\\s\\S]{0,400}"${key}"`), `${key} 를 저장 payload 가 실어야 한다`);
  }
  assert.match(html, /for \(const k of DEV_CONN_KEYS\) if \(x\[k\] !== undefined\) e\[k\] = x\[k\]/,
    "접속 필드는 명시로 되돌려보내야 한다 — 흘리면 조용히 옛 값에 묶인다");
  // 빈칸의 뜻이 둘로 갈린다: 원래 있던 값을 지우는 것과, 화면이 그 값을 모르는 것. 백엔드가
  // 안 보낸 필드를 보존하므로, 모르는 값을 빈칸이라는 이유로 "" 로 지워서는 안 된다.
  assert.match(html, /function putField\(out, base, key, value\)[\s\S]{0,320}base\[key\] !== undefined/,
    "빈칸이 '지움'인지 '모름'인지를 원래 값으로 갈라야 한다");
  // 용도(mode)는 타입과 다른 축이다 — 시뮬레이터 페이지가 이 값으로 기기를 고른다.
  assert.match(html, /mode: document\.getElementById\("dev-mode"\)\.value === "sim" \? "sim" : "real"/,
    "용도는 편집기가 정해야 한다");
  // 가상 PTZ 는 타입 바깥이다(백엔드도 타입을 보지 않는다) — host 필드 안에 두면 접속 대상이
  // 없는 타입에서 통째로 숨어 편집할 길이 사라진다.
  const hostFields = html.slice(html.indexOf('id="dev-host-fields"'), html.indexOf('id="dev-vptz"'));
  assert.doesNotMatch(hostFields, /id="dev-vptz-on"/, "가상 PTZ 는 host 필드 밖에 있어야 한다");
  // 나쁜 화각은 백엔드에서 400 이 되고 부팅 시 드라이버 생성자를 던지게 한다. 여기서 먼저 막는다.
  assert.match(html, /가상 PTZ 소스 화각은 0~180 사이여야 합니다/, "가상 PTZ 화각을 저장 전에 검증해야 한다");

  // 목록 순서는 사용자가 정한다 — 백엔드가 배열을 정렬하지 않고 받은 차례 그대로 저장하므로
  // 화면에서 끌어 놓은 차례가 곧 저장되는 차례다.
  assert.match(html, /row\.draggable = true/, "행을 끌 수 있어야 한다");
  assert.match(html, /async function moveDevice\([\s\S]{0,700}commitDevices\(/,
    "순서 변경도 그 자리에서 서버에 저장되어야 한다");
  assert.match(html, /"dragover"[\s\S]{0,160}preventDefault\(\)/,
    "dragover 에서 preventDefault 하지 않으면 drop 이 발생하지 않는다");

  // 캘리브레이션은 이 페이지 소관이 아니다 — 링크만 남는다.
  assert.doesNotMatch(html, /initCalibCard/);
  assert.match(html, /href="\.\/calibration"/);
  // 페이지 헤더 카메라 셀렉터 없음 — 활성 전환은 '활성 기기' 드롭다운(dev-active)이 담당.
  assert.doesNotMatch(html, /header-camera-select/);
});

test("캘리브레이션 페이지 — 독립 실행 계약", async () => {
  const html = await read("../public/calibration.html");
  for (const id of [
    "calib-card", "calib-desc", "calib-installed", "calib-verify", "calib-start",
    "calib-stop", "calib-advice", "calib-progress", "calib-bar", "calib-msg", "calib-result",
    "header-camera-select",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  // 이 페이지의 유일한 진입점 — 탭 핸들러가 사라졌으므로 반드시 자기가 부른다.
  assert.match(html, /^initCalibCard\(\);$/m, "부트에서 initCalibCard() 를 불러야 한다");
  // 진행 중 카메라 전환 잠금 — cctv 페이지 시절의 전역 setBusy 버튼 쓸기가 우연히 막아 주던
  // 동작이라, 독립 페이지에서는 명시적으로 잠가야 한다(잡이 모는 카메라를 갈아타면 결과 오염).
  assert.match(html, /cam\.setEnabled\(!running\)/);
  // 폴링 누수 방지.
  assert.match(html, /pagehide[\s\S]{0,120}clearInterval\(calibPoll\)/);
  // 외부 의존은 api 모듈 + 공용 크롬/셀렉터뿐 — 논문용 독립성 계약: cctv 쪽 코드를 호출하지
  // 않는다(주석에서 이름을 언급하는 것은 무방 — 호출 형태만 잡는다).
  assert.doesNotMatch(html, /setBusy\(|showSwitching\(|controlPreview\.|discoveryPreview\./);
});

// 캘리브레이션의 산출물은 config 안의 필드가 아니라 발행 후 불변인 리비전 문서다. 그 문서가
// 무엇을 담고 있는지 화면으로 볼 수 있어야 "지금 이 카메라가 어떤 곡선으로 조준하는가"를
// 파일을 열지 않고 답할 수 있다.
test("캘리브레이션 페이지 — 발행된 프로파일 가시화", async () => {
  const html = await read("../public/calibration.html");
  for (const id of ["profile-card", "profile-meta", "profile-charts", "profile-points", "calib-note"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  // 리비전은 발행 후 불변이라 메모를 나중에 고칠 수 없다 — 저장하는 그 순간에 받아야 한다.
  assert.match(html, /note \? \{ note \} : \{\}/, "메모를 적었으면 저장 요청에 실어 보내야 한다");
  // 이름·메모는 사람이 적은 문자열이다 — innerHTML 로 이으면 그대로 마크업이 된다.
  assert.match(html, /v\.textContent = value/, "서버가 준 값은 textContent 로 넣어야 한다");
  assert.match(html, /e\.status === 404/, "발행 전(404)은 장애가 아니라 정상 상태로 안내해야 한다");
});

test("프로파일 차트 — 한 그림에 축은 하나", async () => {
  const src = await readFile(new URL("../src/profile-chart.mjs", import.meta.url), "utf8");
  assert.match(src, /export function miniChart/);
  assert.match(src, /export function chartFigure/);
  // 화각(도)과 조준 게인(배율)은 단위가 다르다. 한 그림에 두 축으로 겹쳐 그리면 두 곡선의
  // 교차점이 아무 의미도 없는데 의미가 있는 것처럼 읽힌다 — 차트를 나눈다.
  assert.doesNotMatch(src, /y2Label|yRight|secondAxis|rightAxis/, "두 번째 y 축을 만들지 않는다");
  // 막대는 범주 비교다 — 값 간격대로 놓으면 촘촘한 구간에서 서로 겹쳐 계단처럼 읽힌다.
  assert.match(src, /slot \* \(i \+ 0\.5\)/, "막대는 차례로 균등 배치해야 한다");
  // 색·글꼴을 하드코딩하면 테마 교체가 차트만 남기고 지나간다.
  assert.match(src, /var\(--color-accent/, "차트 색은 테마 토큰이어야 한다");
});

test("주차면 탐색 페이지 — 독립 실행 계약", async () => {
  const html = await read("../public/discovery.html");
  for (const id of [
    "disc-wrap", "disc-view", "disc-stage", "disc-points", "disc-masks", "disc-home-frame",
    "disc-home-box", "disc-monologue", "disc-crosshair", "disc-preview-mode", "disc-fps",
    "disc-ptz", "disc-status", "disc-name", "disc-add", "disc-preset-props", "disc-list",
    "disc-pt-label", "disc-home-status", "disc-vlm", "disc-vlm-replace", "disc-home-start",
    "disc-home-stop", "disc-clear", "disc-point-props", "disc-ptlist",
    "home-replay", "hr-img", "hr-overlay", "hr-cross", "hr-caption", "hr-prev", "hr-next", "hr-play", "hr-close",
    "header-camera-select",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  // 자기 PTZ 폴링을 갖는다 — 제어 콘솔의 loopPtz 에 얹혀 있던 시절의 탭 가드는 사라져야 한다.
  assert.match(html, /async function loopPtz\(\)/);
  assert.doesNotMatch(html, /activeTab/);
  // 숨겨진 탭에서 카메라를 깨우지 않는 규칙은 유지(회귀 그물: 하루 10만 건 폴링 사고).
  assert.match(html, /if \(document\.hidden\) \{ setTimeout\(loopPtz, 800\); return; \}/);
  // 잡 진행 중에는 카메라 전환을 잠근다 — 잡이 몰던 카메라를 갈아타면 결과가 섞인다.
  assert.match(html, /function setBusy[\s\S]{0,220}cam\.setEnabled\(!on\)/);
  // 스트림 누수 방지.
  assert.match(html, /pagehide[\s\S]{0,80}discoveryPreview\.stop\(\)/);
});

// 백엔드 미연결 게이트 — 이 UI 는 백엔드와 분리 배포된다. 백엔드가 대답하지 않으면 첫 화면이
// 이유 없이 비어 보이면 안 되고, 할 수 없는 일로 가는 바로가기가 열려 있어도 안 된다.
// (설정과 대문만 남는다 — 설정은 주소를 정하는 곳이고 대문은 백엔드가 필요 없다.)
test("page-chrome 이 백엔드 미연결을 감지해 안내하고 설정 외 바로가기를 잠근다", async () => {
  const src = await readFile(new URL("../src/page-chrome.mjs", import.meta.url), "utf8");
  assert.match(src, /showBackendGate/, "미연결 시 안내 게이트를 띄워야 한다");
  assert.match(src, /function lockLink/, "잠금은 href 를 떼는 방식이어야 한다(감추지 않는다)");
  // 프로브 실패 경로에서만 게이트가 뜬다 — 성공 경로에서 뜨면 정상 사용을 막는다.
  assert.match(src, /\.catch\(\(e\)\s*=>\s*\{[\s\S]*showBackendGate/,
    "게이트는 프로브 실패(catch)에서만 떠야 한다");
  // 응답이 왔어도 baro 백엔드가 아니면 실패로 본다 — 엉뚱한 서버의 200 을 연결로 오인하면
  // 화면이 열린 채 전 기능이 조용히 죽는다.
  assert.match(src, /not a baro backend/, "버전 필드가 없는 200 응답은 연결로 치지 않아야 한다");
  assert.match(src, /data-i18n-skip/, "게이트 배너는 i18n 워커가 덮어쓰지 않아야 한다");
});

test("대문 카드 잠금은 설정 카드를 남긴다", async () => {
  const src = await readFile(new URL("../src/page-chrome.mjs", import.meta.url), "utf8");
  assert.match(src, /a\.home-card/, "대문 카드도 잠금 대상이어야 한다");
  assert.match(src, /settingsHref/, "설정 카드는 예외로 남겨야 한다 — 벗어날 길이 사라진다");
});
