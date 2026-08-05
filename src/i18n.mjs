// Tiny i18n for the no-build control UI. Keyed by the KOREAN source string (the app's
// original language), so most static HTML needs no markup: applyI18n() walks text nodes
// + placeholder/title attrs and swaps them. Dynamic JS strings call t("한국어"). Elements
// with inline markup carry data-i18n-html="<key>" and are swapped via innerHTML.
//
//   import { initI18n, applyI18n, setLang, getLang, t } from "./web/i18n.mjs";
//   initI18n();                       // detect + translate static DOM on load
//   el.textContent = t("대기 중");     // dynamic string
//   applyI18n(container);             // after rendering a list/card with Korean literals

const LANGS = ["ko", "en", "vi"];
const STORE_KEY = "baro_lang";
const TITLE_KEY = typeof document === "undefined" ? "Baro Calory · CCTV 제어" : document.title;

// ko source -> { en, vi }. ko is the key itself (returned as-is for lang "ko").
const DICT = {
  // 백엔드 미연결 게이트 (page-chrome) — 이 UI 는 백엔드와 분리 배포되므로 첫 방문자가
  // "왜 아무것도 안 보이나"를 알 수 있어야 한다.
  "백엔드 API 주소가 설정되지 않았습니다":
    { en: "Backend API address is not configured", vi: "Chưa cấu hình địa chỉ API backend" },
  "백엔드에 연결할 수 없습니다":
    { en: "Cannot reach the backend", vi: "Không thể kết nối tới backend" },
  "이 화면은 UI 뿐입니다. 설정에서 백엔드 주소를 먼저 지정하세요.":
    { en: "This is the UI only. Set the backend address in Settings first.",
      vi: "Đây chỉ là giao diện. Hãy đặt địa chỉ backend trong Cài đặt trước." },
  "주소는 맞는데 응답이 없습니다 — 백엔드가 떠 있는지, 주소·포트가 맞는지 확인하세요.":
    { en: "The address is set but there is no answer — check that the backend is running and the host/port are right.",
      vi: "Đã đặt địa chỉ nhưng không có phản hồi — kiểm tra backend có đang chạy và host/cổng có đúng không." },
  "설정으로 이동": { en: "Go to Settings", vi: "Tới Cài đặt" },
  "미설정 — 백엔드 주소를 지정해야 나머지 화면이 동작합니다":
    { en: "Not set — the rest of the app needs a backend address",
      vi: "Chưa đặt — phần còn lại cần địa chỉ backend" },
  "연결됨": { en: "Connected", vi: "Đã kết nối" },
  "연결 테스트": { en: "Test connection", vi: "Kiểm tra kết nối" },
  "응답 없음": { en: "No response", vi: "Không có phản hồi" },
  "연결 실패": { en: "Connection failed", vi: "Kết nối thất bại" },
  "백엔드가 떠 있는지, 주소·포트가 맞는지 확인하세요":
    { en: "Check that the backend is running and the host/port are correct",
      vi: "Kiểm tra backend có đang chạy và host/cổng có đúng không" },
  "출처가 다르면 백엔드가 이 주소를 CORS 로 허용해야 합니다":
    { en: "If the origin differs, the backend must allow this origin via CORS",
      vi: "Nếu khác origin, backend phải cho phép origin này qua CORS" },
  "Baro Calory · CCTV 제어": { en: "Baro Calory · CCTV Control", vi: "Baro Calory · Điều khiển CCTV" },
  "Baro Calory · 시뮬레이터 셋업": { en: "Baro Calory · Simulator Setup", vi: "Baro Calory · Thiết lập mô phỏng" },
  "Baro Calory · 설정": { en: "Baro Calory · Settings", vi: "Baro Calory · Cài đặt" },
  "Baro Calory · 주차면 탐색": { en: "Baro Calory · Spot Discovery", vi: "Baro Calory · Khám phá chỗ đỗ" },
  "스크린샷": { en: "Screenshot", vi: "Ảnh màn hình" },
  "스크린샷 다운로드 — 원본은 카메라에서 새로 받고, 화면은 지금 보이는 프레임 그대로":
    { en: "Download a screenshot — 'original' pulls a fresh full-resolution frame from the camera, 'screen' saves exactly what you see",
      vi: "Tải ảnh chụp — 'gốc' lấy khung hình đầy đủ mới từ camera, 'màn hình' lưu đúng những gì bạn thấy" },
  "스크린샷 해상도": { en: "Screenshot resolution", vi: "Độ phân giải ảnh chụp" },
  "원본 해상도": { en: "Full resolution", vi: "Độ phân giải gốc" },
  "화면 해상도": { en: "Screen resolution", vi: "Độ phân giải màn hình" },
  "Baro Calory · 카메라 캘리브레이션": { en: "Baro Calory · Camera Calibration", vi: "Baro Calory · Hiệu chuẩn camera" },
  // landing / gate (대문)
  "주차장 CCTV 관제 시스템": { en: "Parking CCTV Control System", vi: "Hệ thống điều khiển CCTV bãi đỗ" },
  "CCTV 제어 앱": { en: "CCTV Control App", vi: "Ứng dụng điều khiển CCTV" },
  "PTZ 제어 · 주차면 탐색 · 검출 테스트를 포함한 전체 관제 콘솔": { en: "Full console: PTZ control, spot discovery, detection tests", vi: "Bảng điều khiển đầy đủ: điều khiển PTZ, khám phá chỗ đỗ, kiểm tra phát hiện" },
  "심플 뷰 (테스트)": { en: "Simple View (Test)", vi: "Xem đơn giản (Kiểm tra)" },
  "카메라 전환 · 라이브 피드 · PTZ · 클릭 센터링만 담은 경량 예제": { en: "Lightweight example: camera switch, live feed, PTZ, click-to-center", vi: "Ví dụ gọn nhẹ: chuyển camera, luồng trực tiếp, PTZ, nhấp căn giữa" },
  "열기 →": { en: "Open →", vi: "Mở →" },
  "기타 도구": { en: "Other Tools", vi: "Công cụ khác" },
  "화질 비교": { en: "Image Quality Compare", vi: "So sánh chất lượng ảnh" },
  "캡처 화질 비교 · 톤 보정 레퍼런스": { en: "Capture quality comparison · tone reference", vi: "So sánh chất lượng chụp · tham chiếu tông màu" },

  // header / tabs
  "화면을 클릭하면 그 지점이 가운데로 옵니다": { en: "Click the view to bring that point to the center", vi: "Nhấp vào màn hình để đưa điểm đó vào giữa" },
  "제어 · 모니터링": { en: "Control · Monitoring", vi: "Điều khiển · Giám sát" },
  "주차면 탐색": { en: "Spot Discovery", vi: "Khám phá chỗ đỗ" },
  "설정": { en: "Settings", vi: "Cài đặt" },

  // control: preview bar
  "프리뷰: 스트림": { en: "Preview: Stream", vi: "Xem trước: Luồng" },
  "프리뷰: 스냅샷": { en: "Preview: Snapshot", vi: "Xem trước: Ảnh chụp" },
  "스냅샷 간격": { en: "Snapshot interval", vi: "Khoảng chụp ảnh" },
  "(스트림=MJPEG 연속 · 스냅샷=폴링, 0=최대)": { en: "(Stream=MJPEG continuous · Snapshot=polling, 0=max)", vi: "(Luồng=MJPEG liên tục · Chụp=thăm dò, 0=tối đa)" },

  // control: cards
  "현재 PTZ": { en: "Current PTZ", vi: "PTZ hiện tại" },
  "주차면 등록": { en: "Register Spot", vi: "Đăng ký chỗ đỗ" },
  "와이드샷 저장": { en: "Save Wide Shot", vi: "Lưu ảnh góc rộng" },
  "와이드샷 복귀": { en: "Return to Wide Shot", vi: "Về ảnh góc rộng" },
  "이름 (선택)": { en: "Name (optional)", vi: "Tên (tùy chọn)" },
  "현재 위치를 주차면으로 저장": { en: "Save current position as a spot", vi: "Lưu vị trí hiện tại làm chỗ đỗ" },
  "와이드샷에서 주차면을 클릭하거나 네모로 드래그하세요.": { en: "Click a spot in the wide shot or drag a box.", vi: "Nhấp vào chỗ đỗ trên ảnh góc rộng hoặc kéo một khung." },
  "중지": { en: "Stop", vi: "Dừng" },
  "Detector 테스트": { en: "Detector Test", vi: "Kiểm tra Detector" },
  "VPD 테스트": { en: "VPD Test", vi: "Kiểm tra VPD" },
  "LPD 테스트": { en: "LPD Test", vi: "Kiểm tra LPD" },
  "LPR 테스트": { en: "LPR Test", vi: "Kiểm tra LPR" },
  "전체 테스트": { en: "Test All", vi: "Kiểm tra tất cả" },
  "현재 화면 스냅샷을 검출 API로 보내고 결과 박스를 영상 위에 표시합니다.": { en: "Sends the current snapshot to the detection API and draws result boxes on the video.", vi: "Gửi ảnh chụp hiện tại tới API phát hiện và vẽ khung kết quả lên video." },
  "로그": { en: "Log", vi: "Nhật ký" },

  // discovery
  "프리셋 (구도)": { en: "Presets (Framing)", vi: "Cài đặt sẵn (Bố cục)" },
  "프리셋 이름": { en: "Preset name", vi: "Tên cài đặt sẵn" },
  "현재 카메라 구도를 새 프리셋으로 저장": { en: "Save the current camera framing as a new preset", vi: "Lưu bố cục camera hiện tại thành cài đặt sẵn mới" },
  "아직 프리셋 없음": { en: "No presets yet", vi: "Chưa có cài đặt sẵn" },
  "주차면 점": { en: "Spot Points", vi: "Điểm chỗ đỗ" },
  "VLM 주차인식": { en: "VLM Parking Detect", vi: "VLM Nhận diện đỗ xe" },
  "기존 점 교체": { en: "Replace existing points", vi: "Thay điểm hiện có" },
  "대기 중": { en: "Idle", vi: "Đang chờ" },
  "프리셋을 선택하세요.": { en: "Select a preset.", vi: "Hãy chọn một cài đặt sẵn." },
  "점을 선택하세요.": { en: "Select a point.", vi: "Hãy chọn một điểm." },

  // homing replay modal
  "호밍 과정": { en: "Homing Process", vi: "Quá trình dò" },
  "닫기 ✕": { en: "Close ✕", vi: "Đóng ✕" },
  "◀ 이전": { en: "◀ Prev", vi: "◀ Trước" },
  "다음 ▶": { en: "Next ▶", vi: "Tiếp ▶" },
  "▶ 자동재생": { en: "▶ Autoplay", vi: "▶ Tự động phát" },
  "확인 불가": { en: "Unavailable", vi: "Không thể xác minh" },
  "보류": { en: "Uncertain", vi: "Chưa xác định" },
  "호밍 종료": { en: "Homing finished", vi: "Dò hoàn tất" },
  "번호판 확인 불가": { en: "Plate not visible", vi: "Không nhìn thấy biển số" },
  "판정 보류": { en: "Decision uncertain", vi: "Chưa thể kết luận" },
  "타깃 판정 보류": { en: "Target ambiguous", vi: "Mục tiêu chưa rõ" },
  "검출기 누락": { en: "Detector miss", vi: "Bộ phát hiện bỏ sót" },
  "검출기 오류": { en: "Detector error", vi: "Lỗi bộ phát hiện" },
  "타깃 추적 상실": { en: "Target lost", vi: "Mất mục tiêu" },
  "번호판 면이 보임": { en: "Plate face visible", vi: "Mặt biển số nhìn thấy được" },
  "번호판 영역이 가려짐": { en: "Plate area occluded", vi: "Vùng biển số bị che" },
  "번호판이 있는 면이 보이지 않음": { en: "Plate-bearing side not visible", vi: "Không thấy mặt có biển số" },
  "최종 가시성 판정:": { en: "Final visibility decision:", vi: "Kết luận khả năng quan sát:" },

  // simulator settings tab (씬 제어 = sim 기기 기반)
  "기기": { en: "Device", vi: "Thiết bị" },
  "시뮬레이터 목록": { en: "Simulator list", vi: "Danh sách mô phỏng" },
  "＋ 추가": { en: "＋ Add", vi: "＋ Thêm" },
  "시뮬레이터 상세": { en: "Simulator details", vi: "Chi tiết mô phỏng" },
  "시뮬레이터 상세: {id}": { en: "Simulator details: {id}", vi: "Chi tiết mô phỏng: {id}" },
  "새 시뮬레이터": { en: "New simulator", vi: "Mô phỏng mới" },
  "신규": { en: "New", vi: "Mới" },
  "사용 중": { en: "Active", vi: "Đang dùng" },
  "UE 시뮬레이터 (Hucoms 호환)": { en: "UE simulator (Hucoms-compatible)", vi: "Mô phỏng UE (tương thích Hucoms)" },
  "무카메라 mock": { en: "Camera-less mock", vi: "Mock không camera" },
  "카메라 포트": { en: "Camera port", vi: "Cổng camera" },
  "MJPEG 포트": { en: "MJPEG port", vi: "Cổng MJPEG" },
  "씬 포트": { en: "Scene port", vi: "Cổng scene" },
  "씬 연결 테스트": { en: "Test scene connection", vi: "Kiểm tra kết nối scene" },
  "저장": { en: "Save", vi: "Lưu" },
  "추가 취소": { en: "Cancel add", vi: "Hủy thêm" },
  "저장 + 재연결": { en: "Save + Reconnect", vi: "Lưu + Kết nối lại" },
  "저장 중...": { en: "Saving...", vi: "Đang lưu..." },
  "연결 테스트 중...": { en: "Testing connection...", vi: "Đang kiểm tra kết nối..." },
  "연결 테스트 실패": { en: "Connection test failed", vi: "Kiểm tra kết nối thất bại" },
  "상태 확인 실패": { en: "Status check failed", vi: "Kiểm tra trạng thái thất bại" },
  "{f}를 입력하세요.": { en: "Enter {f}.", vi: "Nhập {f}." },
  "호스트를 입력하세요.": { en: "Enter the host.", vi: "Nhập host." },
  "계정을 입력하세요.": { en: "Enter the account.", vi: "Nhập tài khoản." },
  "비밀번호를 입력하세요.": { en: "Enter the password.", vi: "Nhập mật khẩu." },
  "시뮬레이터를 선택하거나 추가하세요.": { en: "Select or add a simulator.", vi: "Chọn hoặc thêm mô phỏng." },
  "등록된 시뮬레이터가 없습니다.": { en: "No simulators registered.", vi: "Chưa đăng ký mô phỏng." },
  "등록된 시뮬레이터가 없습니다 — 왼쪽의 추가 버튼으로 등록하세요.": { en: "No simulators — add one with the button on the left.", vi: "Chưa có mô phỏng — hãy thêm bằng nút bên trái." },
  "상세 정보를 입력한 뒤 저장하세요.": { en: "Enter the details, then save.", vi: "Nhập thông tin chi tiết rồi lưu." },
  "무카메라 mock 기기 — 씬 연결 없음(인메모리).": { en: "Camera-less mock — no scene connection (in-memory).", vi: "Mock không camera — không có kết nối scene (trong bộ nhớ)." },
  "시뮬레이터 추가 완료: {id}": { en: "Simulator added: {id}", vi: "Đã thêm mô phỏng: {id}" },
  "시뮬레이터 설정 저장 완료: {id}": { en: "Simulator settings saved: {id}", vi: "Đã lưu cài đặt mô phỏng: {id}" },
  "시뮬레이터 삭제 완료: {id}": { en: "Simulator deleted: {id}", vi: "Đã xóa mô phỏng: {id}" },
  "시뮬레이터 '{name}'을(를) 삭제할까요?": { en: "Delete simulator '{name}'?", vi: "Xóa mô phỏng '{name}'?" },
  "삭제 중…": { en: "Deleting…", vi: "Đang xóa…" },
  "삭제 실패": { en: "Delete failed", vi: "Xóa thất bại" },
  "씬 포트를 입력하세요 (UE 씬 제어 HTTP 포트, 기본 8095).": { en: "Enter the scene port (UE scene-control HTTP port, default 8095).", vi: "Nhập cổng scene (cổng HTTP điều khiển scene UE, mặc định 8095)." },
  "sim 기기가 없습니다 — CCTV 설정 탭에서 기기를 먼저 등록하세요.": { en: "No sim device — register one in the CCTV settings tab first.", vi: "Không có thiết bị sim — hãy đăng ký trong tab cài đặt CCTV trước." },
  "무카메라 mock 기기 — 씬 연결 없음(인메모리). UE에 붙이려면 hucoms 타입 sim 기기를 사용하세요.": { en: "Camera-less mock device — no scene connection (in-memory). Use a hucoms-type sim device to attach to UE.", vi: "Thiết bị mock không camera — không có kết nối scene (trong bộ nhớ). Dùng thiết bị sim loại hucoms để nối UE." },
  "무카메라 mock 기기는 연결 설정이 없습니다.": { en: "A camera-less mock device has no connection settings.", vi: "Thiết bị mock không camera không có cài đặt kết nối." },
  "편집 중인 기기가 삭제되었습니다 — 새로고침 후 다시 시도하세요.": { en: "The device being edited was deleted — refresh and try again.", vi: "Thiết bị đang chỉnh sửa đã bị xóa — làm mới rồi thử lại." },
  "씬 제어 설정 저장 + 재연결 완료": { en: "Scene-control settings saved + reconnected", vi: "Đã lưu cài đặt điều khiển scene + kết nối lại" },

  // settings
  "서비스 상태": { en: "Service Status", vi: "Trạng thái dịch vụ" },
  "백엔드 …": { en: "Backend …", vi: "Backend …" },
  "카메라 …": { en: "Camera …", vi: "Camera …" },
  "검출기 …": { en: "Detector …", vi: "Detector …" },
  "LPR …": { en: "LPR …", vi: "LPR …" },
  "상태 새로고침": { en: "Refresh status", vi: "Làm mới trạng thái" },
  "페이지를 열면 자동 확인합니다": { en: "Checked automatically when the page opens", vi: "Tự động kiểm tra khi mở trang" },
  "현재 연결": { en: "Current Connection", vi: "Kết nối hiện tại" },
  "불러오는 중…": { en: "Loading…", vi: "Đang tải…" },
  "기기 (장치)": { en: "Device", vi: "Thiết bị" },
  "활성 기기": { en: "Active device", vi: "Thiết bị đang dùng" },
  "＋ 기기 추가": { en: "＋ Add device", vi: "＋ Thêm thiết bị" },
  "기기 편집": { en: "Edit device", vi: "Sửa thiết bị" },
  "이름": { en: "Name", vi: "Tên" },
  "타입": { en: "Type", vi: "Loại" },
  "정문 CCTV": { en: "Front-gate CCTV", vi: "CCTV cổng chính" },
  "호스트": { en: "Host", vi: "Host" },
  "포트": { en: "Port", vi: "Cổng" },
  "계정": { en: "Account", vi: "Tài khoản" },
  "비밀번호": { en: "Password", vi: "Mật khẩu" },
  "삭제": { en: "Delete", vi: "Xóa" },
  "취소": { en: "Cancel", vi: "Hủy" },
  // 설정 화면 탭
  "서버": { en: "Server", vi: "Máy chủ" },
  "검출·판독": { en: "Detection & LPR", vi: "Phát hiện & LPR" },
  "검출기 (baro_detector_api)": { en: "Detector (baro_detector_api)", vi: "Detector (baro_detector_api)" },
  "검출기 URL": { en: "Detector URL", vi: "URL Detector" },
  "차량+번호판 통합 (vpd+lpd). 경로: /vpd/api/v2 · /lpd/api/v1": { en: "Vehicle+plate unified (vpd+lpd). Paths: /vpd/api/v2 · /lpd/api/v1", vi: "Gộp xe+biển số (vpd+lpd). Đường dẫn: /vpd/api/v2 · /lpd/api/v1" },
  "검출기 테스트": { en: "Test detector", vi: "Kiểm tra detector" },
  "LPR 판독 (외부 OCR)": { en: "LPR Reading (external OCR)", vi: "Đọc LPR (OCR ngoài)" },
  "번호판 문자 인식 — 검출기와 별개의 외부 서비스.": { en: "License-plate character recognition — a separate external service from the detector.", vi: "Nhận dạng ký tự biển số — dịch vụ ngoài, tách biệt với detector." },
  "API 키 (VLM)": { en: "API Keys (VLM)", vi: "Khóa API (VLM)" },
  "sk-ant-… (비우면 기존 유지)": { en: "sk-ant-… (leave blank to keep current)", vi: "sk-ant-… (để trống để giữ nguyên)" },
  "sk-… (비우면 기존 유지)": { en: "sk-… (leave blank to keep current)", vi: "sk-… (để trống để giữ nguyên)" },
  "번호판 호밍": { en: "Plate Homing", vi: "Dò biển số" },
  "이 탭 저장 + 즉시 적용 (무중단)": { en: "Save this tab + apply now (no restart)", vi: "Lưu tab này + áp dụng ngay (không gián đoạn)" },

  // ── dynamic: shared / control ──
  "카메라 이동 중…": { en: "Moving camera…", vi: "Đang di chuyển camera…" },
  "읽기 실패": { en: "Read failed", vi: "Đọc thất bại" },
  "이 기기는 위치를 알려주지 않습니다 (상대 이동 전용)": { en: "This device does not report its position (relative move only)", vi: "Thiết bị này không báo vị trí (chỉ di chuyển tương đối)" },
  "상대 이동": { en: "Relative move", vi: "Di chuyển tương đối" },
  "기준기 (무카메라)": { en: "Reference (no camera)", vi: "Thiết bị chuẩn (không camera)" },
  "Baro Reference CCTV — 전 기능 기준기 (무카메라)": { en: "Baro Reference CCTV — full-capability reference (no camera)", vi: "Baro Reference CCTV — thiết bị chuẩn đầy đủ (không camera)" },
  "Baro Reference CCTV — 부분 기능 계열 (무카메라)": { en: "Baro Reference CCTV — partial-capability family (no camera)", vi: "Baro Reference CCTV — nhóm chức năng một phần (không camera)" },
  "현재 {p}": { en: "Now {p}", vi: "Hiện tại {p}" },
  "마킹: ({x}, {y})": { en: "Marked: ({x}, {y})", vi: "Đã đánh dấu: ({x}, {y})" },
  "— 드래그 영역": { en: "— drag area", vi: "— vùng kéo" },
  "— 클릭 지점": { en: "— click point", vi: "— điểm nhấp" },
  "· 화면을 조정한 뒤 저장하세요.": { en: "· Adjust the view, then save.", vi: "· Chỉnh màn hình rồi lưu." },
  "센터링 ({x}, {y}) → {p}": { en: "Centering ({x}, {y}) → {p}", vi: "Căn giữa ({x}, {y}) → {p}" },
  "센터링 실패": { en: "Centering failed", vi: "Căn giữa thất bại" },
  "박스줌 ({x1},{y1})-({x2},{y2}) → {p}": { en: "Box-zoom ({x1},{y1})-({x2},{y2}) → {p}", vi: "Phóng khung ({x1},{y1})-({x2},{y2}) → {p}" },
  "박스줌 실패": { en: "Box-zoom failed", vi: "Phóng khung thất bại" },

  // ── dynamic: spots ──
  "저장됨: {p}": { en: "Saved: {p}", vi: "Đã lưu: {p}" },
  "와이드샷 없음": { en: "No wide shot", vi: "Chưa có ảnh rộng" },
  "저장된 주차면 없음": { en: "No saved spots", vi: "Chưa có chỗ đỗ đã lưu" },
  "이동": { en: "Go", vi: "Đi" },
  "주차면 목록 실패": { en: "Spot list failed", vi: "Tải danh sách chỗ đỗ thất bại" },
  "{name} 으로 이동 → {p}": { en: "Move to {name} → {p}", vi: "Đi tới {name} → {p}" },
  "이동 실패": { en: "Move failed", vi: "Di chuyển thất bại" },
  "{name} 삭제됨": { en: "{name} deleted", vi: "Đã xóa {name}" },
  "와이드샷 저장됨 (현재 PTZ 기준)": { en: "Wide shot saved (current PTZ)", vi: "Đã lưu ảnh rộng (PTZ hiện tại)" },
  "와이드샷 저장 실패": { en: "Save wide shot failed", vi: "Lưu ảnh rộng thất bại" },
  "와이드샷 복귀 → {p}": { en: "Return to wide shot → {p}", vi: "Về ảnh rộng → {p}" },
  "와이드샷 복귀 실패": { en: "Return to wide shot failed", vi: "Về ảnh rộng thất bại" },
  "저장 불가: 먼저 와이드샷에서 주차면을 클릭/드래그하세요.": { en: "Cannot save: first click/drag a spot in the wide shot.", vi: "Không thể lưu: hãy nhấp/kéo chỗ đỗ trên ảnh rộng trước." },
  "주차면 저장: {name} ({x},{y}) → {p}": { en: "Spot saved: {name} ({x},{y}) → {p}", vi: "Đã lưu chỗ đỗ: {name} ({x},{y}) → {p}" },
  "주차면 저장 실패": { en: "Save spot failed", vi: "Lưu chỗ đỗ thất bại" },


  // ── dynamic: detector test ──
  "테스트 중…": { en: "Testing…", vi: "Đang kiểm tra…" },
  "{x} 테스트 중…": { en: "Testing {x}…", vi: "Đang kiểm tra {x}…" },
  "테스트 완료: {ok}/{total} 응답 · 영상 위 박스 {n}개": { en: "Test done: {ok}/{total} responded · {n} boxes on video", vi: "Kiểm tra xong: {ok}/{total} phản hồi · {n} khung trên video" },
  "Detector 테스트 완료: {ok}/{total} 응답, 박스 {n}개": { en: "Detector test done: {ok}/{total} responded, {n} boxes", vi: "Kiểm tra Detector xong: {ok}/{total} phản hồi, {n} khung" },
  "테스트 실패": { en: "Test failed", vi: "Kiểm tra thất bại" },
  "Detector 테스트 실패": { en: "Detector test failed", vi: "Kiểm tra Detector thất bại" },
  "결과 없음": { en: "No results", vi: "Không có kết quả" },
  "HTTP {s} · {c}개 · {ms}ms": { en: "HTTP {s} · {c} items · {ms}ms", vi: "HTTP {s} · {c} mục · {ms}ms" },
  "실패 · {ms}ms": { en: "fail · {ms}ms", vi: "lỗi · {ms}ms" },
  "응답은 정상이나 검출 항목은 없습니다.": { en: "Response OK but no detections.", vi: "Phản hồi OK nhưng không có phát hiện." },

  // ── dynamic: settings / devices ──
  "Hucoms PTZ (실물)": { en: "Hucoms PTZ (real)", vi: "Hucoms PTZ (thật)" },
  "시뮬레이터": { en: "Simulator", vi: "Trình mô phỏng" },
  "등록됨": { en: "registered", vi: "đã đăng ký" },
  "미등록": { en: "not set", vi: "chưa đặt" },
  "설정 로드 실패": { en: "Config load failed", vi: "Tải cấu hình thất bại" },
  "등록된 기기가 없습니다 — '＋ 추가'로 등록하세요.": { en: "No devices — add one with '＋ Add'.", vi: "Không có thiết bị — thêm bằng '＋ Thêm'." },
  "기기 없음": { en: "No devices", vi: "Không có thiết bị" },
  "편집": { en: "Edit", vi: "Sửa" },
  "(저장됨 · 변경 시에만 입력)": { en: "(saved · enter only to change)", vi: "(đã lưu · chỉ nhập khi đổi)" },
  "기기 편집: {id}": { en: "Edit device: {id}", vi: "Sửa thiết bị: {id}" },
  "ID를 입력하세요": { en: "Enter an ID", vi: "Nhập ID" },
  "host를 입력하세요": { en: "Enter a host", vi: "Nhập host" },
  "이미 있는 id: {id}": { en: "id already exists: {id}", vi: "id đã tồn tại: {id}" },
  "편집 중인 기기가 없습니다": { en: "No device being edited", vi: "Không có thiết bị đang sửa" },
  "새 기기": { en: "New device", vi: "Thiết bị mới" },
  "삭제할 기기를 먼저 선택하세요": { en: "Select a device to delete first", vi: "Hãy chọn thiết bị cần xóa trước" },
  "최소 1개 기기는 있어야 합니다": { en: "At least one device is required", vi: "Cần ít nhất một thiết bị" },
  "기기 '{id}' 를 삭제합니다. 되돌릴 수 없습니다.": { en: "Delete device '{id}'. This cannot be undone.", vi: "Xóa thiết bị '{id}'. Không thể hoàn tác." },
  "저장됨": { en: "Saved", vi: "Đã lưu" },
  "행을 눌러 오른쪽에서 편집하고, 끌어서 순서를 바꿉니다.":
    { en: "Click a row to edit it on the right; drag to reorder.",
      vi: "Nhấp một hàng để sửa bên phải; kéo để đổi thứ tự." },
  "기기 속성": { en: "Device properties", vi: "Thuộc tính thiết bị" },
  // 용도(mode) — 타입과 다른 축이다. 시뮬레이터 페이지가 이 값으로 기기를 고른다.
  "용도": { en: "Role", vi: "Vai trò" },
  "실기 — 실제 카메라": { en: "Real — physical camera", vi: "Thật — camera vật lý" },
  "시뮬레이터 페이지의 카메라 목록에 나타납니다.":
    { en: "Appears in the Simulator page's camera list.",
      vi: "Xuất hiện trong danh sách camera của trang Mô phỏng." },
  "시뮬레이터 페이지에는 나타나지 않습니다.":
    { en: "Does not appear on the Simulator page.",
      vi: "Không xuất hiện trên trang Mô phỏng." },
  // 접속 상세 — "붙긴 붙는데 화면이 안 나온다"를 푸는 값들.
  "스킴": { en: "Scheme", vi: "Giao thức" },
  "자동 (드라이버 기본)": { en: "Auto (driver default)", vi: "Tự động (mặc định driver)" },
  "프리뷰·전송 상세": { en: "Preview & transport details", vi: "Chi tiết xem trước & truyền" },
  "RTSP 경로": { en: "RTSP path", vi: "Đường dẫn RTSP" },
  "RTSP 포트": { en: "RTSP port", vi: "Cổng RTSP" },
  "프리뷰 fps": { en: "Preview fps", vi: "fps xem trước" },
  "상한 없음": { en: "no cap", vi: "không giới hạn" },
  "비우면 스냅샷 폴링으로 내려갑니다. 경로는 벤더 규약이고 번호가 무슨 코덱인지는 기기 설정이 정합니다 — ffprobe 로 확인한 값을 넣으세요. fps 는 기기 실제 fps 를 넣으면 중복 프레임이 사라집니다.":
    { en: "Leave blank to fall back to snapshot polling. The path is a vendor convention and which codec a number maps to is decided by the device — put in what ffprobe reports. Setting fps to the device's real rate removes duplicate frames.",
      vi: "Để trống sẽ quay về lấy ảnh tĩnh. Đường dẫn là quy ước của hãng và số nào ứng với codec nào do thiết bị quyết định — hãy nhập giá trị ffprobe báo. Đặt fps đúng tốc độ thật sẽ hết khung trùng." },
  "타임아웃": { en: "Timeout", vi: "Hết giờ" },
  "없음": { en: "none", vi: "không có" },
  "MJPEG 포트가 있으면 RTSP 대신 그 포트를 그대로 중계합니다. 씬 포트는 시뮬레이터의 주차·차량 배치 제어 창구입니다.":
    { en: "With an MJPEG port set, that port is proxied directly instead of RTSP. The scene port is the simulator's parking/vehicle placement control.",
      vi: "Nếu có cổng MJPEG, cổng đó được chuyển tiếp trực tiếp thay cho RTSP. Cổng cảnh điều khiển bố trí bãi/xe của mô phỏng." },
  "TLS 인증서 검증 안 함": { en: "Skip TLS certificate verification", vi: "Bỏ qua xác minh chứng chỉ TLS" },
  "공장 자체서명 인증서를 쓰는 HTTPS 기기에만. 이 기기 하나에만 적용됩니다.":
    { en: "Only for HTTPS devices with a factory self-signed certificate. Applies to this device alone.",
      vi: "Chỉ cho thiết bị HTTPS dùng chứng chỉ tự ký của hãng. Chỉ áp dụng cho thiết bị này." },
  "모듈": { en: "Module", vi: "Mô-đun" },
  "영상 채널": { en: "Video ch.", vi: "Kênh hình" },
  "PTZ 채널": { en: "PTZ ch.", vi: "Kênh PTZ" },
  "한 서버가 여러 카메라를 무는 기기에서 몇 번 채널인지. 비우면 0번으로 붙습니다 — 3번 카메라를 등록했는데 1번 화면이 나오면 이 값입니다.":
    { en: "Which channel, on devices where one server carries several cameras. Blank connects to channel 0 — if you registered camera 3 but see camera 1, this is the field.",
      vi: "Kênh số mấy, với thiết bị mà một máy chủ mang nhiều camera. Để trống sẽ nối kênh 0 — nếu đăng ký camera 3 mà thấy camera 1, đây là ô cần sửa." },
  // 가상 PTZ — 고정형 소스 위의 소프트웨어 팬틸트줌.
  "가상 PTZ (고정형 카메라)": { en: "Virtual PTZ (fixed camera)", vi: "PTZ ảo (camera cố định)" },
  "사용": { en: "Enable", vi: "Bật" },
  "소스 화각": { en: "Source HFOV", vi: "HFOV nguồn" },
  "최대 배율": { en: "Max zoom", vi: "Phóng tối đa" },
  "소스 폭": { en: "Source width", vi: "Rộng nguồn" },
  "소스 높이": { en: "Source height", vi: "Cao nguồn" },
  "소스 화각(수평, 0~180)만 있으면 켜집니다. 해상도는 첫 스냅샷의 실측값으로 자동 갱신되고, 최대 배율은 1 초과 64 이하입니다.":
    { en: "A source HFOV (horizontal, 0–180) is all it needs. Resolution is refreshed from the first snapshot; max zoom is above 1 and up to 64.",
      vi: "Chỉ cần HFOV nguồn (ngang, 0–180). Độ phân giải được cập nhật từ ảnh chụp đầu tiên; phóng tối đa lớn hơn 1 và tối đa 64." },
  "가상 PTZ 소스 화각은 0~180 사이여야 합니다":
    { en: "Virtual PTZ source HFOV must be between 0 and 180",
      vi: "HFOV nguồn của PTZ ảo phải trong khoảng 0–180" },
  "가상 PTZ 최대 배율은 1 초과 64 이하여야 합니다":
    { en: "Virtual PTZ max zoom must be above 1 and at most 64",
      vi: "Phóng tối đa của PTZ ảo phải lớn hơn 1 và tối đa 64" },
  "Hucoms CGI 를 평문 HTTP 로 확인한 결과입니다 — 다른 규약의 기기는 이 결과와 무관하게 스킴·RTSP 경로가 맞아야 화면이 나옵니다.":
    { en: "This checked a Hucoms CGI over plain HTTP — for devices on another protocol the scheme and RTSP path still have to be right before any picture appears.",
      vi: "Phép thử này gọi CGI Hucoms qua HTTP thường — với thiết bị dùng giao thức khác, vẫn phải đúng scheme và đường dẫn RTSP thì mới có hình." },
  "순서 저장 중…": { en: "Saving order…", vi: "Đang lưu thứ tự…" },
  "순서 저장됨": { en: "Order saved", vi: "Đã lưu thứ tự" },
  "순서 저장 실패": { en: "Failed to save order", vi: "Lưu thứ tự thất bại" },
  // 캘리브레이션 재사용 — 발행된 프로파일을 다른 기기에 빌려 붙인다.
  "캘리브레이션": { en: "Calibration", vi: "Hiệu chuẩn" },
  "보정 없음": { en: "No calibration", vi: "Không hiệu chuẩn" },
  "내장 프리셋": { en: "built-in preset", vi: "cài đặt sẵn" },
  "조준 곡선만 (구형식)": { en: "aiming curve only (legacy)", vi: "chỉ đường cong ngắm (cũ)" },
  "이 카메라 실측": { en: "measured on this camera", vi: "đo trên camera này" },
  "지정됨": { en: "set", vi: "đã đặt" },
  "발행본 rev {rev} 적용": { en: "published rev {rev} applied", vi: "đã áp dụng rev {rev}" },
  "유지": { en: "Keep", vi: "Giữ" },
  "의 실측값 빌리기": { en: "— borrow its measurements", vi: "— mượn số đo của nó" },
  "에서 빌림": { en: "borrowed", vi: "đã mượn" },
  "클릭 센터링이 보정 없이 동작합니다.": { en: "Click-to-center runs uncorrected.", vi: "Nhấp căn giữa chạy không hiệu chỉnh." },
  "지금 값을 그대로 둡니다": { en: "Leaves the current value untouched", vi: "Giữ nguyên giá trị hiện tại" },
  "다른 카메라의 실측값입니다 — 캘리브레이션은 개체마다 다르므로, 적용한 뒤 '검증'을 돌려 이 개체에 맞는지 확인하세요.":
    { en: "These are another camera's measurements. Calibration differs per unit — after applying, run 'Verify' to confirm it fits this one.",
      vi: "Đây là số đo của camera khác. Hiệu chuẩn khác nhau theo từng máy — sau khi áp dụng, hãy chạy 'Kiểm tra'." },
  "프로파일을 읽는 중…": { en: "Reading profile…", vi: "Đang đọc hồ sơ…" },
  "그 프로파일에는 화각 곡선이 없습니다": { en: "That profile has no FOV curve", vi: "Hồ sơ đó không có đường cong FOV" },
  "프로파일을 읽지 못했습니다": { en: "Could not read the profile", vi: "Không đọc được hồ sơ" },

  // 프로파일 관리 창구(캘리브레이션 페이지) — 복사·수입·적용·퇴역.
  "복사": { en: "Copy", vi: "Sao chép" },
  "수입": { en: "Import", vi: "Nhập" },
  "적용": { en: "Apply", vi: "Áp dụng" },
  "퇴역": { en: "Retire", vi: "Cho nghỉ" },
  "발행": { en: "Publish", vi: "Phát hành" },
  "닫기": { en: "Close", vi: "Đóng" },
  "원본": { en: "Source", vi: "Nguồn" },
  "리비전": { en: "Revision", vi: "Bản sửa" },
  "메모": { en: "Note", vi: "Ghi chú" },
  "출처": { en: "Origin", vi: "Xuất xứ" },
  "앵커": { en: "Anchors", vi: "Điểm neo" },
  "실측": { en: "Measured", vi: "Đã đo" },
  "적용중": { en: "in use", vi: "đang dùng" },
  "게이트 우회": { en: "gate bypassed", vi: "đã bỏ qua cổng" },
  "처리 중…": { en: "Working…", vi: "Đang xử lý…" },
  "메모 (선택)": { en: "Note (optional)", vi: "Ghi chú (tùy chọn)" },
  "리비전 {n}개": { en: "{n} revisions", vi: "{n} bản sửa" },
  "최초 실측 기기: {id}": { en: "First measured on: {id}", vi: "Đo lần đầu trên: {id}" },
  "조준 게인 곡선 포함": { en: "includes the aiming-gain curve", vi: "gồm đường cong hệ số ngắm" },
  "화각 곡선만 — 조준 보정 없음": { en: "FOV curve only — no aiming correction", vi: "chỉ đường cong FOV — không hiệu chỉnh ngắm" },
  "다른 카메라의 발행본을 이 카메라의 새 리비전으로 복사합니다.":
    { en: "Copies another camera's published profile into a new revision for this camera.",
      vi: "Sao hồ sơ đã phát hành của camera khác thành bản sửa mới cho camera này." },
  "복사할 수 있는 다른 카메라의 발행본이 없습니다.":
    { en: "No other camera has a published profile to copy.",
      vi: "Không có camera nào khác có hồ sơ để sao." },
  "캘리브레이션은 카메라 개체마다 다릅니다 — 복사한 뒤 검증을 돌려 이 개체에 맞는지 확인하세요. 곡선만 옮겨지고 기기 규격(줌 눈금·배선)은 이 카메라 것으로 다시 기록됩니다.":
    { en: "Calibration differs per unit — after copying, run Verify to confirm it fits this one. Only the curves move; the device spec (zoom scale, wiring) is re-stamped from this camera.",
      vi: "Hiệu chuẩn khác nhau theo từng máy — sau khi sao, hãy chạy Kiểm tra. Chỉ đường cong được chuyển; thông số thiết bị được ghi lại theo camera này." },
  "곡선을 직접 넣어 발행합니다. 스윕을 돌릴 수 없는 기기를 위한 문입니다.":
    { en: "Publish curves you type in. This is the door for devices that cannot be swept.",
      vi: "Phát hành đường cong bạn nhập. Đây là lối cho thiết bị không quét được." },
  "이 값의 출처 (예: 제조사 매뉴얼) — 권장":
    { en: "Where these numbers came from (e.g. vendor manual) — recommended",
      vi: "Nguồn của các số này (vd: sổ tay hãng) — nên ghi" },
  "zoomHfov 는 {z, h}(줌 눈금, 수평화각°) 를 z 오름차순으로 최소 2개. centeringGain 은 {z, k} 이며 없으면 조준 보정 없이 화각만 답합니다. 재지 않은 값이므로 문서에 '수입'으로 남고 잔차는 비어 있습니다.":
    { en: "zoomHfov takes at least two {z, h} pairs (zoom scale, horizontal FOV°) in ascending z. centeringGain takes {z, k}; without it the camera reports FOV but aims uncorrected. Nothing was measured here, so the document records 'import' and leaves the residual empty.",
      vi: "zoomHfov cần ít nhất hai cặp {z, h} theo z tăng dần. centeringGain là {z, k}; thiếu nó thì chỉ báo FOV mà không hiệu chỉnh ngắm. Không đo gì ở đây nên tài liệu ghi 'nhập' và bỏ trống phần dư." },
  "발행된 리비전을 이 백엔드의 런타임에 깝니다. 옛 리비전을 고르면 되돌리기입니다.":
    { en: "Loads a published revision into this backend's runtime. Pick an older one to roll back.",
      vi: "Nạp bản sửa đã phát hành vào runtime. Chọn bản cũ để quay lui." },
  "이 카메라에는 아직 발행본이 없습니다.":
    { en: "This camera has no published profile yet.", vi: "Camera này chưa có hồ sơ phát hành." },
  "발행본과 지금 쓰는 값이 다릅니다 — 조준과 화각이 발행본 기준으로 틀립니다.":
    { en: "The published profile and the values in use disagree — aim and FOV are wrong relative to the published profile.",
      vi: "Hồ sơ phát hành và giá trị đang dùng khác nhau — ngắm và FOV sai so với hồ sơ." },
  "발행본 적용": { en: "Apply published", vi: "Áp dụng bản phát hành" },
  "최신 발행본을 런타임에 깔아 이 차이를 없앱니다. 재측정은 필요 없습니다.":
    { en: "Loads the latest published profile into the runtime and closes this gap. No re-measurement needed.",
      vi: "Nạp hồ sơ mới nhất vào runtime để xóa chênh lệch. Không cần đo lại." },
  "rev {rev} 을 적용했습니다 — 백엔드를 재시작하면 실제 조준에 반영됩니다 (pm2 restart baro-backend).":
    { en: "Applied rev {rev} — restart the backend for aiming to actually use it (pm2 restart baro-backend).",
      vi: "Đã áp dụng rev {rev} — khởi động lại backend để ngắm dùng giá trị này." },
  "{from} 에서 복사해 rev {rev} 로 발행했습니다 — 백엔드 재시작 후 적용됩니다.":
    { en: "Copied from {from} and published rev {rev} — takes effect after a backend restart.",
      vi: "Đã sao từ {from} và phát hành rev {rev} — có hiệu lực sau khi khởi động lại backend." },
  "rev {rev} 로 발행했습니다 — 백엔드 재시작 후 적용됩니다.":
    { en: "Published rev {rev} — takes effect after a backend restart.",
      vi: "Đã phát hành rev {rev} — có hiệu lực sau khi khởi động lại backend." },
  "rev {revs} 를 퇴역시켰습니다. 지금 쓰는 값은 그대로입니다.":
    { en: "Retired rev {revs}. The values in use are unchanged.",
      vi: "Đã cho nghỉ rev {revs}. Giá trị đang dùng không đổi." },
  "JSON 을 읽지 못했습니다": { en: "Could not parse the JSON", vi: "Không đọc được JSON" },
  "{from} 에서 복사해 rev {rev} 발행":
    { en: "copied from {from}, published rev {rev}", vi: "sao từ {from}, phát hành rev {rev}" },
  "프로파일 복사 실패": { en: "Profile copy failed", vi: "Sao hồ sơ thất bại" },
  "취소됨": { en: "Cancelled", vi: "Đã hủy" },
  "삭제됨: {id}": { en: "Deleted: {id}", vi: "Đã xóa: {id}" },
  "활성 적용 실패:": { en: "active apply failed:", vi: "áp dụng thiết bị đang dùng thất bại:" },
  "'{id}'(으)로 전환 중…": { en: "Switching to '{id}'…", vi: "Đang chuyển sang '{id}'…" },
  "✅ '{id}'(으)로 전환됨 (무중단)": { en: "✅ Switched to '{id}' (no restart)", vi: "✅ Đã chuyển sang '{id}' (không gián đoạn)" },
  "전환 실패": { en: "Switch failed", vi: "Chuyển thất bại" },
  "백엔드": { en: "Backend", vi: "Backend" },
  "카메라": { en: "Camera", vi: "Camera" },
  "검출기": { en: "Detector", vi: "Detector" },
  "프로브 중…": { en: "Probing…", vi: "Đang dò…" },
  "✅ 응답 · 모델 {model} · FW {fw}": { en: "✅ Responded · model {model} · FW {fw}", vi: "✅ Có phản hồi · model {model} · FW {fw}" },
  "❌ 응답 없음": { en: "❌ No response", vi: "❌ Không phản hồi" },
  "프로브 실패": { en: "Probe failed", vi: "Dò thất bại" },
  "✅ 응답 (status {s})": { en: "✅ Responded (status {s})", vi: "✅ Có phản hồi (status {s})" },
  "저장 중…": { en: "Saving…", vi: "Đang lưu…" },
  "✅ 저장됨.": { en: "✅ Saved.", vi: "✅ Đã lưu." },
  "✅ 저장 + 즉시 적용됨 (무중단).": { en: "✅ Saved + applied now (no restart).", vi: "✅ Đã lưu + áp dụng ngay (không gián đoạn)." },
  "✅ 저장됨 — 단, 활성 적용 실패:": { en: "✅ Saved — but active apply failed:", vi: "✅ Đã lưu — nhưng áp dụng thiết bị đang dùng thất bại:" },
  "저장 실패": { en: "Save failed", vi: "Lưu thất bại" },

  // ── dynamic: discovery ──
  "프리셋 로드 실패": { en: "Preset load failed", vi: "Tải cài đặt sẵn thất bại" },
  "아직 프리셋 없음 — 카메라 구도를 맞춘 뒤 추가하세요.": { en: "No presets yet — frame the camera, then add.", vi: "Chưa có cài đặt sẵn — chỉnh bố cục camera rồi thêm." },
  "{n}점": { en: "{n} pts", vi: "{n} điểm" },
  "점 없음": { en: "No points", vi: "Không có điểm" },
  "프리셋 구도에서 영상 위를 클릭하면 주차면 점이 추가됩니다.": { en: "Click the video in a preset framing to add a spot point.", vi: "Nhấp vào video ở bố cục cài đặt sẵn để thêm điểm chỗ đỗ." },
  "녹색=호밍 성공 · 빨강=실패 · 노랑=처리중": { en: "green=homing OK · red=fail · yellow=in progress", vi: "xanh=dò OK · đỏ=thất bại · vàng=đang xử lý" },
  "클릭하면 이 프리셋을 선택하고 그 구도로 이동합니다.": { en: "Click to select this preset and move to its framing.", vi: "Nhấp để chọn cài đặt sẵn này và di chuyển tới bố cục của nó." },
  "이 프리셋 구도로 카메라 이동": { en: "Move the camera to this preset's framing", vi: "Di chuyển camera tới bố cục của cài đặt sẵn này" },
  "프리셋 추가됨 (현재 카메라 위치를 저장).": { en: "Preset added (saved current camera position).", vi: "Đã thêm cài đặt sẵn (đã lưu vị trí camera hiện tại)." },
  "추가 실패": { en: "Add failed", vi: "Thêm thất bại" },
  "먼저 프리셋을 선택하세요.": { en: "Select a preset first.", vi: "Hãy chọn cài đặt sẵn trước." },
  "계산중…": { en: "Computing…", vi: "Đang tính…" },
  "VLM 주차인식 계산 중… (수십 초)": { en: "VLM parking detection… (tens of seconds)", vi: "VLM nhận diện đỗ xe… (vài chục giây)" },
  "VLM({prov}·{model}) 주차인식: 점 {c}개 {act}.": { en: "VLM({prov}·{model}) parking detect: {c} points {act}.", vi: "VLM({prov}·{model}) nhận diện đỗ xe: {c} điểm {act}." },
  "교체": { en: "replaced", vi: "thay thế" },
  "추가": { en: "added", vi: "thêm" },
  "VLM 인식 실패": { en: "VLM detection failed", vi: "VLM nhận diện thất bại" },
  "프리셋에 점이 없습니다 (먼저 점을 찍거나 VLM 자동 검출).": { en: "Preset has no points (place points or run VLM auto-detect first).", vi: "Cài đặt sẵn chưa có điểm (đặt điểm hoặc chạy VLM tự phát hiện trước)." },
  "번호판 호밍 시작 — 카메라가 점마다 줌인합니다.": { en: "Plate homing started — the camera zooms in on each point.", vi: "Bắt đầu dò biển số — camera phóng to từng điểm." },
  "호밍 시작 실패": { en: "Homing start failed", vi: "Bắt đầu dò thất bại" },
  "이미 호밍이 진행 중입니다.": { en: "Homing is already running.", vi: "Đang dò rồi." },
  "점 '{name}' 번호판 호밍 시작…": { en: "Plate homing for point '{name}'…", vi: "Dò biển số cho điểm '{name}'…" },
  "이 점은 과정 기록이 없습니다.": { en: "This point has no process record.", vi: "Điểm này không có bản ghi quá trình." },
  "점 '{name}' 번호판 호밍 과정 — {n}스텝": { en: "Plate-homing process for point '{name}' — {n} steps", vi: "Quá trình dò biển số điểm '{name}' — {n} bước" },
  "⏸ 정지": { en: "⏸ Pause", vi: "⏸ Tạm dừng" },
  "중지 실패": { en: "Stop failed", vi: "Dừng thất bại" },
  "완료": { en: "Done", vi: "Hoàn tất" },
  "중지됨": { en: "Stopped", vi: "Đã dừng" },
  // 프리뷰 정지 상태 — 화면 중앙에 글자로 뜬다(깨진 이미지 아이콘 대신).
  "정지됨": { en: "Paused", vi: "Đã tạm dừng" },
  "백그라운드 — 자동 정지": { en: "Background — stopped automatically", vi: "Nền — tự động dừng" },
  "이 점은 아직 번호판 호밍이 안 됐습니다.": { en: "This point hasn't been plate-homed yet.", vi: "Điểm này chưa được dò biển số." },
  "점 '{name}' 번호판으로 이동…": { en: "Moving to plate of point '{name}'…", vi: "Đang tới biển số của điểm '{name}'…" },
  "번호판 보기 실패": { en: "View plate failed", vi: "Xem biển số thất bại" },
  "이름 변경 실패": { en: "Rename failed", vi: "Đổi tên thất bại" },
  "프리셋으로 이동 중…": { en: "Moving to preset…", vi: "Đang tới cài đặt sẵn…" },
  "'{name}' 구도. 영상 위를 클릭해 주차면 점을 찍으세요.": { en: "'{name}' framing. Click the video to place spot points.", vi: "Bố cục '{name}'. Nhấp lên video để đặt điểm chỗ đỗ." },
  "점 로드 실패": { en: "Point load failed", vi: "Tải điểm thất bại" },
  "아직 점 없음 — 프리셋 구도에서 영상을 클릭하세요.": { en: "No points yet — click the video in a preset framing.", vi: "Chưa có điểm — nhấp video ở bố cục cài đặt sẵn." },
  "조준": { en: "Aim", vi: "Ngắm" },
  "처리중": { en: "Processing", vi: "Đang xử lý" },
  "성공": { en: "OK", vi: "OK" },
  "실패": { en: "Failed", vi: "Thất bại" },
  "미호밍": { en: "Not homed", vi: "Chưa dò" },
  "이 점을 화면 중앙으로 조준": { en: "Aim this point to the center of the view", vi: "Ngắm điểm này vào giữa màn hình" },
  "삭제할 점이 없습니다.": { en: "No points to delete.", vi: "Không có điểm để xóa." },
  "호밍": { en: "Homing", vi: "Dò" },
  "번호판": { en: "Plate", vi: "Biển số" },
  "과정": { en: "Process", vi: "Quá trình" },
  "전체 삭제": { en: "Delete all", vi: "Xóa tất cả" },
  "호밍 중": { en: "Homing", vi: "Đang dò" },
  "호밍 종료 — 성공 {ok}/{total}": { en: "Homing done — {ok}/{total} succeeded", vi: "Dò xong — {ok}/{total} thành công" },
  "이 프리셋의 주차면 점 {n}개를 모두 삭제할까요?": { en: "Delete all {n} spot points of this preset?", vi: "Xóa toàn bộ {n} điểm chỗ đỗ của cài đặt sẵn này?" },
  "점 {n}개 삭제됨.": { en: "{n} points deleted.", vi: "Đã xóa {n} điểm." },
  "현재 프레임의 주차 차량을 VLM으로 자동 검출해 점으로 추가": { en: "Auto-detect parked cars in the current frame with a VLM and add them as points", vi: "Tự động phát hiện xe đỗ trong khung hiện tại bằng VLM và thêm làm điểm" },
  "자동 검출 시 기존 점을 지우고 교체": { en: "Replace existing points on auto-detect", vi: "Thay điểm hiện có khi tự động phát hiện" },
  "모든 점을 순회하며 번호판까지 줌인 호밍": { en: "Home every point, zooming in to each plate", vi: "Dò tất cả điểm, phóng to tới từng biển số" },
  "이 프리셋의 주차면 점 전체 삭제": { en: "Delete all spot points of this preset", vi: "Xóa toàn bộ điểm chỗ đỗ của cài đặt sẵn này" },
  "이 점만 다시 번호판 호밍": { en: "Re-home plate for this point only", vi: "Dò lại biển số chỉ điểm này" },
  "이 점만 번호판 호밍": { en: "Plate-home this point only", vi: "Dò biển số chỉ điểm này" },
  "번호판 확대 보기 (z{z})": { en: "Zoom in on plate (z{z})", vi: "Phóng to biển số (z{z})" },
  "호밍 줌인 과정 다시보기 ({n}스텝)": { en: "Replay homing zoom-in process ({n} steps)", vi: "Xem lại quá trình phóng to dò ({n} bước)" },
  "프리셋 구도에서만 점을 찍을 수 있습니다. (프리셋을 클릭해 이동)": { en: "You can only place points in the preset framing. (click a preset to move)", vi: "Chỉ có thể đặt điểm ở bố cục cài đặt sẵn. (nhấp cài đặt sẵn để di chuyển)" },
  "점 '{name}' 추가 ({x},{y}).": { en: "Point '{name}' added ({x},{y}).", vi: "Đã thêm điểm '{name}' ({x},{y})." },
  "점 추가 실패": { en: "Add point failed", vi: "Thêm điểm thất bại" },
  "이름 수정 (Enter로 저장)": { en: "Edit name (Enter to save)", vi: "Sửa tên (Enter để lưu)" },
  "조준 중…": { en: "Aiming…", vi: "Đang ngắm…" },
  "'{name}' 조준.": { en: "Aimed '{name}'.", vi: "Đã ngắm '{name}'." },
  "조준 실패": { en: "Aim failed", vi: "Ngắm thất bại" },

  // ── dynamic: settings detail + homing status + replay captions ──
  "활성": { en: "Active", vi: "Đang dùng" },
  "— '연결 테스트'로 실물/시뮬·모델 확인": { en: "— use 'Test connection' to verify real/sim·model", vi: "— dùng 'Kiểm tra kết nối' để xác nhận thật/mô phỏng·model" },
  "점": { en: "point", vi: "điểm" },
  "판 {w}px": { en: "plate {w}px", vi: "biển {w}px" },
  "성공 {ok}/{total}": { en: "success {ok}/{total}", vi: "thành công {ok}/{total}" },
  "· 카메라 복귀 실패(수동 확인 필요)": { en: "· camera return failed (manual check needed)", vi: "· camera không về được (cần kiểm tra thủ công)" },
  "호밍 상태 조회 실패(재시도 중)": { en: "Homing status query failed (retrying)", vi: "Truy vấn trạng thái dò thất bại (đang thử lại)" },
  "스텝 <b>{step}</b> · z{z} · 판폭 <b>{w}px</b>": { en: "step <b>{step}</b> · z{z} · plate width <b>{w}px</b>", vi: "bước <b>{step}</b> · z{z} · rộng biển <b>{w}px</b>" },
  "스텝 <b>{step}</b> · z{z} · <span style=\"color:#e0556b\">번호판 없음(후보 {n})</span>": { en: "step <b>{step}</b> · z{z} · <span style=\"color:#e0556b\">no plate (candidates {n})</span>", vi: "bước <b>{step}</b> · z{z} · <span style=\"color:#e0556b\">không có biển (ứng viên {n})</span>" },
  "기하 폴백": { en: "geometry fallback", vi: "dự phòng hình học" },
  "내 차 판 선택(#{i})": { en: "my-car plate selected (#{i})", vi: "đã chọn biển xe của tôi (#{i})" },
  "접근 시도(부분/소형 판 — 더 가까이)": { en: "approach attempt (partial/small plate — closer)", vi: "thử tiếp cận (biển một phần/nhỏ — gần hơn)" },
  "내 차 판 없음(드리프트 차단)": { en: "no my-car plate (drift blocked)", vi: "không có biển xe tôi (chặn trôi)" },
  "선비(VLM):": { en: "Scholar (VLM):", vi: "Học giả (VLM):" },
  "점 '{name}' 번호판 보기 — z{z} · {px}px (프리셋을 클릭하면 와이드 복귀).": { en: "Point '{name}' plate view — z{z} · {px}px (click a preset to return wide).", vi: "Điểm '{name}' xem biển — z{z} · {px}px (nhấp cài đặt sẵn để về rộng)." },
  "프리셋 '{name}'을(를) 삭제할까요? (그 안의 점들도 함께 삭제)": { en: "Delete preset '{name}'? (its points are deleted too)", vi: "Xóa cài đặt sẵn '{name}'? (các điểm bên trong cũng bị xóa)" },

  // ── shared browser modules: camera-preview + ptz-controls ──
  "프리뷰: 스트림(MJPEG)": { en: "Preview: Stream (MJPEG)", vi: "Xem trước: Luồng (MJPEG)" },
  "스트림": { en: "Stream", vi: "Luồng" },
  "스트림 연결 중…": { en: "Connecting stream…", vi: "Đang kết nối luồng…" },
  "MJPEG 스트림 사용 불가 → 스냅샷 폴링으로 전환": { en: "MJPEG stream unavailable → switching to snapshot polling", vi: "Không dùng được luồng MJPEG → chuyển sang chụp thăm dò" },
  "⏸ 일시정지": { en: "⏸ Paused", vi: "⏸ Tạm dừng" },
  "이동 → {p}": { en: "Move → {p}", vi: "Di chuyển → {p}" },
  "절대 이동 → {p}": { en: "Absolute move → {p}", vi: "Di chuyển tuyệt đối → {p}" },
  "절대 이동 실패": { en: "Absolute move failed", vi: "Di chuyển tuyệt đối thất bại" },
  "수동 조정 (이동량 step)": { en: "Manual control (step)", vi: "Điều khiển thủ công (bước)" },
  "속도": { en: "Speed", vi: "Tốc độ" },
  "절대 위치 이동": { en: "Absolute move", vi: "Di chuyển vị trí tuyệt đối" },
  "채우기": { en: "Fill", vi: "Điền" },

  // ── 스크린샷 ──
  "📷 스크린샷": { en: "📷 Screenshot", vi: "📷 Chụp màn hình" },
  "현재 화면을 이미지로 다운로드": { en: "Download the current view as an image", vi: "Tải khung hình hiện tại thành ảnh" },
  "스크린샷 저장: {name}": { en: "Screenshot saved: {name}", vi: "Đã lưu ảnh chụp: {name}" },
  "스크린샷 실패": { en: "Screenshot failed", vi: "Chụp màn hình thất bại" },
  "스크린샷 실패: 표시 중인 영상 프레임이 없습니다": { en: "Screenshot failed: no video frame is being shown", vi: "Chụp màn hình thất bại: không có khung hình đang hiển thị" },
  "스크린샷 실패: 인코딩 오류": { en: "Screenshot failed: encoding error", vi: "Chụp màn hình thất bại: lỗi mã hóa" },
};

// Elements with inline markup: key -> full innerHTML per language (data-i18n-html="<key>").
const HTML = {
  "sim.settingsHelp": {
    ko: '이 화면은 <b>sim 기기</b>만 관리합니다. 기기 속성은 공용 config에 저장되지만, 현재 사용할 카메라는 앱별로 따로 선택됩니다.',
    en: 'This screen manages <b>sim devices</b> only. Device properties are saved to the shared config, while each app selects its active camera independently.',
    vi: 'Màn hình này chỉ quản lý <b>thiết bị sim</b>. Thuộc tính thiết bị được lưu vào config dùng chung, nhưng mỗi ứng dụng chọn camera đang dùng độc lập.',
  },
  "replay.legend": {
    ko: '흰 박스=후보 LP · <span style="color:#16d05a">녹색=선택</span> · 빨강 십자=중앙',
    en: 'White box=candidate LP · <span style="color:#16d05a">green=selected</span> · red cross=center',
    vi: 'Khung trắng=LP ứng viên · <span style="color:#16d05a">xanh=được chọn</span> · chữ thập đỏ=tâm',
  },
};

function detectLang() {
  const n = (navigator.language || "").toLowerCase();
  if (n.startsWith("vi")) return "vi";
  if (n.startsWith("en")) return "en";
  return "ko";
}

let lang = (() => {
  try { const s = localStorage.getItem(STORE_KEY); if (LANGS.includes(s)) return s; } catch {}
  return detectLang();
})();

export function getLang() { return lang; }
export function languages() { return LANGS.slice(); }

// Translate a trimmed ko key. Returns ko itself when lang is ko or no entry exists.
function tr(ko) {
  if (lang === "ko") return ko;
  const e = DICT[ko];
  return e && e[lang] != null ? e[lang] : ko;
}

// Public: translate a (possibly space-padded) dynamic string, preserving surrounding
// whitespace. Supports {name} placeholders: t("점 {n}개", { n: 3 }). The ko key itself is
// the ko-language template, so params are substituted in every language (including ko).
export function t(s, params) {
  if (s == null) return s;
  const str = String(s);
  const core = str.trim();
  if (!core) return s;
  const lead = str.match(/^\s*/)[0];
  const trail = str.match(/\s*$/)[0];
  const e = DICT[core];
  let out = (lang === "ko" || !e || e[lang] == null) ? core : e[lang];
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
  return lead + out + trail;
}

const ORIG = new WeakMap();      // text node -> original ko value
const ORIG_ATTR = new WeakMap(); // element -> { placeholder, title }

function inSkippedSubtree(node) {
  for (let p = node.parentNode; p; p = p.parentNode) {
    const n = p.nodeName;
    if (n === "SCRIPT" || n === "STYLE" || n === "NOSCRIPT" || n === "TEXTAREA") return true;
    if (p.nodeType === 1 && p.hasAttribute && (p.hasAttribute("data-i18n-html") || p.hasAttribute("data-i18n-skip"))) return true;
  }
  return false;
}

export function applyI18n(root) {
  root = root || document.body;
  // 1) text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (!inSkippedSubtree(n) && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    let o = ORIG.get(n);
    if (o === undefined) { o = n.nodeValue; ORIG.set(n, o); }
    const v = t(o);
    if (n.nodeValue !== v) n.nodeValue = v;
  }
  // 2) placeholder / title attributes
  const scope = root.querySelectorAll ? root : document;
  scope.querySelectorAll("[placeholder],[title]").forEach((el) => {
    let saved = ORIG_ATTR.get(el);
    if (!saved) { saved = { placeholder: el.getAttribute("placeholder"), title: el.getAttribute("title") }; ORIG_ATTR.set(el, saved); }
    for (const a of ["placeholder", "title"]) {
      if (saved[a] != null) { const v = tr(saved[a].trim()); if (el.getAttribute(a) !== v) el.setAttribute(a, v); }
    }
  });
  // 3) inline-markup elements
  scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const e = HTML[el.getAttribute("data-i18n-html")];
    if (e) el.innerHTML = e[lang] != null ? e[lang] : e.ko;
  });
}

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try { localStorage.setItem(STORE_KEY, l); } catch {}
  document.documentElement.lang = l;
  document.title = tr(TITLE_KEY);
  applyI18n(document.body);
  window.dispatchEvent(new CustomEvent("langchange", { detail: l }));
}

export function initI18n() {
  document.documentElement.lang = lang;
  document.title = tr(TITLE_KEY);
  applyI18n(document.body);
}
