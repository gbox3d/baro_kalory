// 페이지 공통 크롬 — 헤더 우측(홈 바로가기·테마·언어·버전)을 채우고 i18n/테마를 초기화한다.
// 각 페이지가 헤더에 <span data-role="chrome"></span> 하나만 두면 나머지는 여기서 주입된다.
// 화면 사이 이동은 대문의 카드가 맡는다 — 헤더에 전 페이지를 늘어놓지 않는다.
import { api, API_BASE, API_BASE_EXPLICIT } from "./api.mjs";
import { initI18n, setLang, getLang, t } from "./i18n.mjs";
import { initTheme } from "./theme.mjs";
import { PAGES, getPage, pageHref } from "./pages.mjs";

// 프런트 버전의 출처는 페이지와 함께 배포되는 app-versions.json 이다(backend 가 아니라 —
// 프런트만 따로 배포하면 backend 가 아는 값은 브라우저가 실제로 도는 버전과 어긋난다).
// 주의: 상대경로 문자열로 fetch 하면 모듈 URL(/web/) 기준으로 풀려 404 가 되므로
// import.meta.url 에서 한 단계 올라간다. `<mount>/web/` → `<mount>/`, dist/web/ → dist/.
async function fetchOwnVersions() {
  try {
    const r = await fetch(new URL("../app-versions.json", import.meta.url));
    return await r.json();
  } catch { return {}; }
}

// home 카드용: [data-version-key] 요소 전부에 "<BADGE> v<x>" 를 채운다.
export async function fillAppVersions(root = document) {
  const own = await fetchOwnVersions();
  for (const el of root.querySelectorAll("[data-version-key]")) {
    const page = PAGES.find((p) => p.versionKey === el.dataset.versionKey);
    if (page) el.textContent = `${page.badge} v${own[page.versionKey] || "—"}`;
  }
}

// 헤더 좌측: 홈(집 아이콘) | 제품·페이지 이름 | 설정. 이 둘만 두는 이유는, 전 페이지를
// 늘어놓으면 화면마다 링크가 대여섯 개씩 붙어 정작 그 페이지의 것(카메라 셀렉터·버전)을
// 밀어내기 때문이다. 나머지 화면으로 가는 길은 대문의 카드가 맡는다.
// 아이콘은 인라인 SVG — currentColor 를 쓰므로 테마와 링크 색을 그대로 따라간다.
const HOME_ICON = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M2.2 7.2 8 2.4l5.8 4.8V14H2.2z"/></svg>';

function headerSep() {
  const s = document.createElement("span");
  s.setAttribute("data-i18n-skip", "");
  s.style.cssText = "margin:0 8px; color:var(--color-muted); font-weight:400;";
  s.textContent = "|";
  return s;
}

// 링크는 h1 안에 들어가므로 제목의 굵기를 상속받지 않게 눌러 준다.
function fillHeaderNav(page) {
  const h1 = document.querySelector("header h1");
  if (!h1) return;
  if (page !== "home") {
    const home = document.createElement("a");
    home.className = "navlink";
    home.setAttribute("data-i18n-skip", "");   // 아이콘 마크업을 i18n 워커에 노출하지 않는다
    home.href = pageHref("home");
    home.title = "홈";
    home.setAttribute("aria-label", "홈");
    home.innerHTML = HOME_ICON;
    home.style.cssText = "font-weight:400; display:inline-flex; align-items:center; vertical-align:-2px;";
    h1.insertBefore(headerSep(), h1.firstChild);
    h1.insertBefore(home, h1.firstChild);
  }
  // 대문에는 설정 링크를 두지 않는다 — 화면 안의 카드가 이미 그 자리로 데려간다.
  if (page !== "settings" && page !== "home") {
    const set = document.createElement("a");
    set.className = "navlink";
    set.href = pageHref("settings");
    set.textContent = "설정";   // 한국어 원문 — applyI18n 이 현재 언어로 바꾼다(skip 아님)
    set.style.cssText = "font-weight:400;";
    // 카메라 셀렉터가 있으면 그 앞에 넣는다 — 이름 바로 뒤가 제자리다(셀렉터는 h1 끝에 온다).
    // 셀렉터가 없는 페이지에서는 insertBefore(…, null) 이 곧 append 다.
    const cam = h1.querySelector(".header-camera");
    h1.insertBefore(headerSep(), cam);
    h1.insertBefore(set, cam);
  }
}

// 링크를 "잠근다" — href 를 떼어 이동 불가로 만들되 글자는 남긴다. 감추지 않는 이유는
// 페이지가 사라진 것이 아니라 **아직 쓸 수 없는 것**이고, 그 사실과 이유가 보여야 하기 때문이다.
function lockLink(a, reason) {
  a.removeAttribute("href");
  a.setAttribute("aria-disabled", "true");
  a.title = reason;
  a.style.opacity = "0.45";
  a.style.cursor = "not-allowed";
}

// 백엔드 미연결 게이트. 백엔드가 대답하지 않으면 (1) 왜 그런지 배너로 말하고 (2) 설정 외의
// 바로가기를 잠근다. 예전에는 같은 마운트에 백엔드가 있다고 **추측**하고 그대로 진행해서,
// 분리 배포에서는 첫 화면이 이유 없이 비어 보였다 — 추측하지 말고 확인한 뒤 안내한다.
function showBackendGate({ page, explicit, base, detail }) {
  const headline = explicit
    ? t("백엔드에 연결할 수 없습니다")
    : t("백엔드 API 주소가 설정되지 않았습니다");
  const guide = explicit
    ? t("주소는 맞는데 응답이 없습니다 — 백엔드가 떠 있는지, 주소·포트가 맞는지 확인하세요.")
    : t("이 화면은 UI 뿐입니다. 설정에서 백엔드 주소를 먼저 지정하세요.");

  const bar = document.createElement("div");
  bar.id = "backend-gate";
  bar.setAttribute("data-i18n-skip", "");
  bar.style.cssText = [
    "padding:10px 14px", "border-bottom:1px solid var(--color-warn,#ca4)",
    "color:var(--color-warn,#ca4)", "font:13px var(--font-mono)",
    "display:flex", "gap:12px", "align-items:center", "flex-wrap:wrap",
  ].join(";");

  const msg = document.createElement("span");
  msg.textContent = `${headline} — ${guide}`;
  bar.appendChild(msg);

  if (base) {
    const who = document.createElement("span");
    who.style.cssText = "opacity:.7";
    who.textContent = `API ${base}${detail ? ` (${detail})` : ""}`;
    bar.appendChild(who);
  }

  if (page !== "settings") {
    const go = document.createElement("a");
    go.className = "navlink";
    go.href = pageHref("settings");
    go.textContent = t("설정으로 이동");
    bar.appendChild(go);
  }

  document.body.insertBefore(bar, document.body.firstChild);

  // 대문 카드 잠금 — 백엔드 없이 열 수 있는 것은 대문(정적 카드뿐)과 설정(주소를 정하는
  // 곳)뿐이다. 나머지는 열어 봐야 할 수 있는 일이 없다. 헤더는 홈 링크만 두므로 잠글 것이
  // 없다(홈은 언제나 열려 있어야 하는 탈출구다).
  const reason = `${headline} — ${guide}`;
  const settingsHref = pageHref("settings");
  for (const a of document.querySelectorAll("a.home-card")) {
    if (a.getAttribute("href") !== settingsHref) lockLink(a, reason);
  }
}

// 페이지 부트스트랩. 반환: { versionEl } — 필요 시 페이지가 배지를 덧쓸 수 있게.
export function initPageChrome({ page }) {
  const current = getPage(page);
  const mount = document.querySelector('header [data-role="chrome"]');
  fillHeaderNav(page);   // 바로가기는 헤더 좌측(이름 양옆), 우측은 테마·언어·버전만
  if (mount) {
    const theme = document.createElement("select");
    theme.setAttribute("data-role", "theme");     // initTheme() 가 이 속성으로 찾아 채운다
    theme.setAttribute("data-i18n-skip", "");
    theme.title = "Theme";
    theme.style.cssText = "width:auto; padding:4px 6px; font-size:12px;";
    mount.appendChild(theme);
    const lang = document.createElement("select");
    lang.id = "lang-select";
    lang.setAttribute("data-i18n-skip", "");
    lang.title = "Language";
    lang.style.cssText = "width:auto; padding:4px 6px; font-size:12px;";
    for (const [v, label] of [["ko", "한국어"], ["en", "English"], ["vi", "Tiếng Việt"]]) {
      lang.appendChild(new Option(label, v));
    }
    mount.appendChild(lang);
    const ver = document.createElement("span");
    ver.id = "version";
    ver.className = "ver";
    ver.textContent = "v—";
    mount.appendChild(ver);
  }

  const langSel = document.getElementById("lang-select");
  if (langSel) { langSel.value = getLang(); langSel.addEventListener("change", () => setLang(langSel.value)); }
  initI18n();
  initTheme();

  // 백엔드 확인 겸 버전 표시. 이 한 번의 호출이 곧 연결 판정이다 — 따로 헬스체크를 더 치면
  // 부팅마다 왕복이 두 번이 되고, 두 결과가 어긋나는 상태까지 생긴다.
  const versionEl = document.getElementById("version");
  const probe = API_BASE_EXPLICIT
    ? fetch(api("/version"), { signal: AbortSignal.timeout(5000) })
    : Promise.reject(new Error("api base not configured"));
  probe
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(async (v) => {
      if (!v || !(v.backendVersion || v.version)) throw new Error("not a baro backend");
      const own = await fetchOwnVersions();
      const mine = current?.versionKey ? `${current.badge} v${own[current.versionKey] || "—"} · ` : "";
      if (versionEl) versionEl.textContent = `${mine}BE v${v.backendVersion || v.version}`;
    })
    .catch((e) => {
      if (versionEl) versionEl.textContent = "";
      showBackendGate({
        page,
        explicit: API_BASE_EXPLICIT,
        base: API_BASE,
        detail: String((e && e.message) || e).slice(0, 60),
      });
    });

  return { versionEl };
}
