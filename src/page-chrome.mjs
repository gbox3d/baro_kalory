// 페이지 공통 크롬 — 헤더 우측(내비·테마·언어·버전 배지·원격 API 배지)을 채우고
// i18n/테마를 초기화한다. 각 페이지가 헤더에 <span data-role="chrome"></span> 하나만 두면
// 나머지는 여기서 주입된다. 페이지가 늘 때 기존 페이지들의 nav 를 손으로 고치다 한 곳을
// 빠뜨리는 사고(발견 불가능한 페이지)를 없애기 위한 모듈 — 링크 목록의 출처는 pages.mjs 하나다.
import { api, API_BASE, API_BASE_EXPLICIT } from "./api.mjs";
import { initI18n, setLang, getLang, t } from "./i18n.mjs";
import { initTheme } from "./theme.mjs";
import { PAGES, getPage, pageHref } from "./pages.mjs";

// 백엔드 없이 열려도 되는 페이지 — 대문(정적 카드뿐)과 설정(백엔드 주소를 정하는 곳).
// 나머지는 백엔드가 없으면 할 수 있는 일이 없으므로 게이트가 잠근다.
const OFFLINE_OK = new Set(["home", "settings"]);

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

  // 헤더 nav + 대문 카드 잠금 — 설정과 대문만 남긴다.
  const reason = `${headline} — ${guide}`;
  for (const a of document.querySelectorAll('header [data-role="chrome"] a.navlink')) {
    if (a.dataset.pageId && !OFFLINE_OK.has(a.dataset.pageId)) lockLink(a, reason);
  }
  const settingsHref = pageHref("settings");
  for (const a of document.querySelectorAll("a.home-card")) {
    if (a.getAttribute("href") !== settingsHref) lockLink(a, reason);
  }
}

// 페이지 부트스트랩. 반환: { versionEl } — 필요 시 페이지가 배지를 덧쓸 수 있게.
export function initPageChrome({ page }) {
  const current = getPage(page);
  const mount = document.querySelector('header [data-role="chrome"]');
  if (mount) {
    for (const p of PAGES) {
      if (p.id === page || p.id === "home" && page === "home") continue;
      const a = document.createElement("a");
      a.className = "navlink";
      a.setAttribute("data-i18n-skip", "");
      a.dataset.pageId = p.id;              // 게이트가 어떤 링크를 잠글지 판정하는 근거
      a.href = pageHref(p.id);
      a.textContent = p.label;
      mount.appendChild(a);
    }
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
    const badge = document.createElement("span");
    badge.id = "apibase-badge";
    badge.setAttribute("data-i18n-skip", "");
    badge.style.cssText = "display:none; margin-left:10px; padding:2px 7px; border:1px solid var(--color-warn,#ca4); color:var(--color-warn,#ca4); font:11px var(--font-mono);";
    badge.title = "이 UI 가 동일 출처가 아닌 원격 backend 를 보고 있습니다 (설정에서 변경)";
    mount.appendChild(badge);
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

  // 원격 base 배지 — 남의 backend 를 보고 있는데 모르는 상태가 제일 위험하다. 동일 출처일 땐 숨김.
  if (API_BASE) {
    const badge = document.getElementById("apibase-badge");
    if (badge) { badge.textContent = `API ${API_BASE}`; badge.style.display = "inline-block"; }
  }

  return { versionEl };
}
