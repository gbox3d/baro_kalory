import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("설정 페이지 — DOM 계약과 부트스트랩", async () => {
  const html = await read("../public/settings.html");
  // 카드 8장의 소유 요소 — 하나라도 빠지면 이식 중 카드가 유실된 것이다.
  for (const id of [
    "st-backend", "st-camera", "st-detector", "st-lpr", "set-refresh-status",   // 서비스 상태
    "set-current",                                                              // 현재 연결
    "apibase-input", "apibase-save", "apibase-clear", "apibase-status",         // API 서버
    "dev-active", "dev-add", "dev-list", "set-cam-id", "dev-name", "dev-type",  // 기기
    "dev-host-fields", "set-cam-host", "set-cam-port", "set-cam-user", "set-cam-pass",
    "dev-apply", "set-probe", "dev-del", "set-probe-out",
    "set-detector", "set-probe-det", "set-det-out",                             // 검출기
    "set-lpr", "set-probe-lpr", "set-lpr-out",                                  // LPR
    "set-key-anthropic", "set-key-openai", "set-key-hint",                      // API 키
    "set-save", "set-save-out",                                                 // 저장
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 누락`);
  }
  assert.match(html, /loadCctvSettings\(\);/, "부트에서 설정을 로드해야 한다");
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
  assert.match(src, /OFFLINE_OK\s*=\s*new Set\(\["home",\s*"settings"\]\)/,
    "백엔드 없이 열 수 있는 페이지는 대문·설정 둘뿐이어야 한다");
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
