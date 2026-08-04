// 페이지 레지스트리 — 이 앱의 페이지 목록을 아는 유일한 곳(브라우저 쪽).
// 헤더 nav·버전 배지·home 카드가 전부 이 표를 본다. 페이지를 추가하면 여기 한 줄과
// 서버 쪽 미러(server.mjs PAGE_ROUTES, 리버스 프록시 설정, pack.mjs)를 함께 고친다.
export const PAGES = [
  { id: "home",        slug: "",            label: "홈",           versionKey: null,          badge: null },
  { id: "cctv",        slug: "cctv",        label: "CCTV 제어",     versionKey: "cctv",        badge: "CCTV" },
  { id: "discovery",   slug: "discovery",   label: "주차면 탐색",    versionKey: "discovery",   badge: "DISC" },
  { id: "simulator",   slug: "simulator",   label: "시뮬레이터 셋업", versionKey: "simulator",   badge: "SIM" },
  { id: "settings",    slug: "settings",    label: "설정",          versionKey: "settings",    badge: "SET" },
  { id: "calibration", slug: "calibration", label: "캘리브레이션",    versionKey: "calibration", badge: "CAL" },
];

export function getPage(id) {
  return PAGES.find((p) => p.id === id) || null;
}

// dist/CDN 정적 배포 감지 — 그 배포에서는 확장자 없는 경로를 서빙할 서버가 없어
// 링크가 ./<slug>.html 이어야 한다. pack.mjs 는 home 카드의 리터럴 href 만 재작성하고,
// JS 가 그리는 nav 는 이 함수가 담당한다.
export function isStaticBuild() {
  try { return location.pathname.endsWith(".html"); } catch { return false; }
}

export function pageHref(id) {
  const p = getPage(id);
  if (!p) return "./";
  if (isStaticBuild()) return p.slug ? `./${p.slug}.html` : "./index.html";
  return p.slug ? `./${p.slug}` : "./";
}
