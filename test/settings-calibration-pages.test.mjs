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

// 캘리브레이션 페이지는 2단이다 — 왼쪽은 저장소에 발행된 것 전량(카메라와 무관한 카탈로그),
// 오른쪽은 지금 고른 카메라의 작업면. 한 단에 세로로 쌓으면 목록에서 고른 것과 오른쪽에 뜬
// 것이 한 화면에 함께 보이지 않아 비교가 성립하지 않는다.
test("캘리브레이션 페이지 — 2단 배치와 프로파일 카탈로그", async () => {
  const html = await read("../public/calibration.html");
  assert.match(html, /#cal-split[^}]*flex-direction: row/, "2단이어야 한다");
  assert.match(html, /\.cal-card-list[^}]*min-height: 0/, "목록 단은 자기 안에서 스크롤해야 한다");
  assert.match(html, /\.cal-col-detail[^}]*overflow-y: auto/, "작업면은 따로 스크롤해야 한다");
  // 쓰기는 전부 오른쪽 창구를 지난다 — 목록이 자기 몫의 복사/적용을 따로 부르면 두 벌이 되고,
  // 두 벌은 언젠가 한쪽만 고쳐진다.
  assert.match(html, /openApplyPanel\(\) : openCopyPanel\(p\.profileId\)/,
    "줄을 누르면 오른쪽 창구가 열려야 한다 (내 것이면 적용, 남의 것이면 그 원본으로 복사)");
  assert.doesNotMatch(html, /profile-list[\s\S]{0,4000}postJson\(api\(`\/profiles/,
    "목록이 직접 쓰기를 부르면 안 된다");
  // 발행·복사·퇴역은 저장소의 목록을 바꾼다 — 함께 다시 읽지 않으면 두 단이 다른 말을 한다.
  assert.match(html, /refreshProfileCard\(\)[\s\S]{0,300}loadProfileList\(\)/,
    "쓰기 뒤에 카탈로그도 다시 읽어야 한다");
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

test("API 오류는 본문을 잃지 않는다", async () => {
  const src = await readFile(new URL("../src/api.mjs", import.meta.url), "utf8");
  // 거절이 언제나 문장 하나인 것은 아니다 — 발행 게이트는 왜·어디를 구조로 준다.
  // 여기서 message 만 뽑으면 화면은 그걸 되살릴 방법이 없다.
  assert.match(src, /err\.body = j/, "오류 응답 본문을 호출부까지 넘겨야 한다");
  assert.match(src, /err\.status = r\.status/, "상태코드도 함께 넘겨야 한다");
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

// 캘리브레이션 데이터가 저장소로 들어오는 문은 오래 "실기 20분 스윕 → 발행" 하나뿐이었다.
// 그래서 스윕을 못 돌리는 기기의 곡선은 갈 곳이 없었고, 설정 화면이 브라우저에서 곡선을
// 복사해 config 에만 넣는 우회로가 생겼다 — 그 결과 대상 카메라는 "보정은 있는데 발행본은
// 없는" 상태가 되어 두 화면이 서로 다른 말을 했다. 창구는 하나여야 한다.
test("캘리브레이션 페이지 — 프로파일 관리 창구", async () => {
  const html = await read("../public/calibration.html");
  for (const id of [
    "profile-drift", "profile-actions", "profile-panel", "profile-msg", "profile-revisions",
    "prof-act-copy", "prof-act-import", "prof-act-apply", "prof-act-retire",
    "profile-list",   // 왼쪽 단: 저장소에 발행된 것 전량(카메라와 무관한 카탈로그)
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }

  // 발행의 정식 이름은 mint 다. /save 는 백엔드가 하위호환으로 남겨 둔 별칭이라 언제
  // 사라져도 이상하지 않다 — 별칭에 매달리지 않는다.
  assert.match(html, /api\("\/calibration\/mint"\)/, "발행은 mint 라우트로 가야 한다");
  assert.doesNotMatch(html, /calibration\/save/, "옛 별칭에 매달리지 않는다");

  // 네 동작이 전부 백엔드 창구를 지난다. 브라우저가 곡선을 만지면 두 곳 중 한 곳만 쓰인다.
  assert.match(html, /\/profiles\/camera\/\$\{encodeURIComponent\(id\)\}\/copy/, "복사는 창구 라우트를 불러야 한다");
  assert.match(html, /\/profiles\/camera\/\$\{encodeURIComponent\(id\)\}\/apply/, "적용은 창구 라우트를 불러야 한다");
  assert.match(html, /reqJson\("DELETE", api\(`\/profiles\/camera\//, "퇴역은 DELETE 여야 한다");
  assert.match(html, /\/profiles\/camera\/\$\{encodeURIComponent\(id\)\}\/revisions/, "이력을 읽어야 한다");

  // 드리프트 판정은 백엔드가 한다. 브라우저가 곡선을 다시 비교하면 두 번째 구현이 생기고,
  // 두 구현은 언젠가 서로 다른 답을 낸다 — 이 카드가 없애려는 병이 정확히 그것이다.
  assert.match(html, /help\?format=json[\s\S]{0,200}profileDrift/, "드리프트는 백엔드 라이브 상태에서 가져와야 한다");
  assert.doesNotMatch(html, /published[\s\S]{0,80}live[\s\S]{0,80}Math\.abs/, "브라우저가 곡선을 다시 비교하면 안 된다");

  // 서버가 준 문자열(경고문·메모·기기명)은 사람이 적은 값이라 innerHTML 로 이으면 마크업이 된다.
  assert.match(html, /d\.textContent = line/, "드리프트 경고는 textContent 로 넣어야 한다");
  assert.match(html, /c\.textContent = text/, "이력 표의 값은 textContent 로 넣어야 한다");

  // 퇴역은 목록에서 사라지고, 되돌리는 방법이 화면에 없다 — 확인을 받아야 한다.
  assert.match(html, /async function retireProfile\(\)[\s\S]{0,600}confirm\(/, "퇴역은 확인을 받아야 한다");
  // 문서를 치웠다고 돌고 있는 카메라의 조준이 말없이 바뀌면 그게 더 나쁘다.
  assert.match(html, /지금 쓰고 있는 값\(런타임\)은 그대로 남습니다/, "퇴역이 런타임을 건드리지 않음을 말해야 한다");

  // 복사본을 "이 카메라 실측"이라고 말하면 안 된다 — 창구가 열린 이상 섞여 들어온다.
  assert.match(html, /Number\.isFinite\(ins\.profileRevision\)/, "깔린 리비전 번호로 출처를 말해야 한다");
});

test("설정 페이지 — 캘리브레이션 빌려오기는 백엔드 창구를 지난다", async () => {
  const html = await read("../public/settings.html");
  // 브라우저가 발행 문서를 뜯어 intrinsics 를 조립하던 우회로는 사라져야 한다. 그 경로는
  // config 한 곳에만 값을 넣어, 대상 카메라에 발행본 없는 보정을 남겼다.
  assert.doesNotMatch(html, /d\.intrinsics = \{[\s\S]{0,200}zoomHfov/, "브라우저가 곡선을 조립하면 안 된다");
  assert.doesNotMatch(html, /에서 빌림/, "빌려온 표시를 값 안에 심지 않는다 — 출처는 발행 문서가 안다");
  // 대신 창구를 부른다. 새 기기는 등록 전이라 422 가 되므로 저장이 끝난 뒤여야 한다.
  assert.match(html, /\/profiles\/camera\/\$\{encodeURIComponent\(staged\.id\)\}\/copy/, "복사는 창구 라우트를 불러야 한다");
  assert.match(html, /commitDevices\([\s\S]{0,400}staged\.borrowFrom/, "복사는 기기 저장 뒤에 와야 한다");
  // 복사가 실패해도 기기 저장은 이미 끝났다 — 조용히 삼키면 "빌렸다고 생각하는" 상태가 남는다.
  assert.match(html, /프로파일 복사 실패/, "복사 실패를 말해야 한다");
  // measuredAt 만 보고 "이 카메라 실측"이라 하면 복사본에 대해 거짓말이 된다.
  assert.match(html, /Number\.isFinite\(ins\.profileRevision\)[\s\S]{0,120}발행본 rev/, "깔린 리비전으로 말해야 한다");
});

// 게이트를 만들면서 우회로를 백엔드에만 두고 화면에는 안 만들었더니, 20분짜리 실측이 막다른
// 길에 섰다(2026-08-05 cam-real-002: alert 하나 띄우고 끝이라 curl 없이는 방법이 없었다).
// 거절은 정보여야지 벽이면 안 된다.
test("캘리브레이션 페이지 — 발행 게이트 거절에 화면 안의 길이 있다", async () => {
  const html = await read("../public/calibration.html");
  // 422 quality_gate 는 alert 이 아니라 카드 안에서 다뤄야 한다.
  assert.match(html, /e\.status === 422 && e\.body && e\.body\.code === "quality_gate"/,
    "게이트 거절을 다른 실패와 갈라 다뤄야 한다");
  assert.match(html, /function renderGateRefusal\(/, "거절 화면이 있어야 한다");
  assert.match(html, /그래도 발행/, "우회 버튼이 화면에 있어야 한다");
  assert.match(html, /saveSweep\(box, true\)/, "우회는 force 로 다시 보내야 한다");
  // 어느 줌이 스윕을 흐렸는지 없으면 남은 선택지는 20분 전체 재측정뿐이다.
  assert.match(html, /function noisyAnchorNote\(/, "시끄러운 앵커를 짚어 줘야 한다");
  assert.match(html, /body\.noisyAnchors/, "거절할 때 앵커를 보여야 한다");
  assert.match(html, /res\.noisyAnchors/, "통과할 때도 앵커를 보여야 한다");
  // 불변 문서에 "왜 이 값이 여기 있나"가 남아야 한다.
  // 메모 입력은 결과 상자 안에 산다 — 거절 화면이 상자를 비우면 함께 사라진다(실제로 그렇게
  // 날려서 우회 발행이 메모 없이 나갔다: cam-real-002 rev 3).
  assert.match(html, /const carried = prev \? prev\.value\.trim\(\) : ""/, "지우기 전에 메모를 건져야 한다");
  assert.match(html, /note\.id = "calib-note"/, "거절 화면이 메모 입력을 다시 세워야 한다");
  assert.match(html, /"발행 기준 미달을 알고 발행: "/, "비었으면 우회 사유로 채워야 한다");
  assert.match(html, /res\.forced/, "우회했다는 사실을 저장 후에도 말해야 한다");
  // 서버 문장은 사람이 읽는 값이라 innerHTML 로 이으면 마크업이 된다.
  assert.match(html, /d\.textContent = line;\s*\/\/ 서버 문장/, "거절 사유는 textContent 로");

  // fitRmsPx 는 앵커별 최댓값이다 — "피팅 67.3px" 로만 적으면 스윕 전체가 그런 줄 읽힌다.
  assert.doesNotMatch(html, /피팅 오차 \$\{r\.residual\.fitRmsPx\}px/, "최댓값을 스윕 성적처럼 적으면 안 된다");
  assert.match(html, /fitRmsMedianPx/, "대표값을 함께 보여야 한다");
});

// 설치 높이는 기기 config 의 필드가 아니라 발행본(프로파일)의 값이다. 그 차이를 화면이
// 지키지 않으면 "저장했는데 왜 안 남지" 또는 "왜 리비전이 하나 더 생겼지"가 된다.
test("설정 › 기기 속성 — 설치 높이는 발행 창구로 나간다", async () => {
  const html = await read("../public/settings.html");
  assert.match(html, /id="dev-height"/, "높이 입력 칸이 있어야 한다");
  assert.match(html, /id="dev-height-hint"/, "지금 발행본이 무엇인지 말해야 한다");

  // 읽기는 config 가 아니라 프로파일에서 — config 왕복에는 이 값이 없다.
  assert.match(html, /getJson\(api\(`\/profiles\/camera\/\$\{encodeURIComponent\(id\)\}`\)\)/);
  // 404 는 장애가 아니라 "아직 발행본이 없다"는 정상 상태다.
  assert.match(html, /e\.status === 404[\s\S]*캘리브레이션을 먼저 발행/);
  // 쓰기는 덮어쓰기가 아니라 새 리비전 발행이라 사람이 확인해야 한다.
  assert.match(html, /confirm\(t\("\{id\} 의 설치 높이를 \{v\} m 로 발행합니다/);
  assert.match(html, /postJson\(api\(`\/profiles\/camera\/\$\{encodeURIComponent\(id\)\}\/extrinsic`\)/);
  // 이 창구의 값은 사람이 잰 것이다 — measured 로 나가면 다음 사람이 근거 없는 값을 실측으로 읽는다.
  assert.match(html, /source: "manual"/);
  // 빈칸은 "지운다"가 아니다. 발행본은 지울 수 없다.
  assert.match(html, /if \(raw === ""\) return "";/);
  // 빌려온 리비전 위에 얹혀야 하므로 복사 다음이어야 한다.
  const save = html.slice(html.indexOf("async function saveEditor()"), html.indexOf("function addDevice()"));
  assert.ok(save.indexOf("staged.borrowFrom") < save.indexOf("publishHeightIfChanged"),
    "높이 발행은 프로파일 빌려오기 다음이어야 한다");
});
