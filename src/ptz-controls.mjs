import { postJson, fmtPtz, api } from "./api.mjs";
import { t, applyI18n } from "./i18n.mjs";

// Renders a PTZ control panel (manual nudge pad + absolute move) into `mount` and
// drives the camera over the REST control plane. Reusable in any tab — the control
// monitor and the layout editor mount their own instance instead of duplicating it.
//
// Callbacks let the host own its PTZ display / busy state / log:
//   onPtz(ptz)         - a move completed; ptz is the settled position
//   onBusy(on, label)  - toggle the host's busy indicator
//   log(msg)           - append to the host's log
//   getLastPtz()       - current PTZ (for fill)
export function createPtzControls(opts) {
  const {
    mount,
    apiBase = api(""),
    overlay = null,
    onPtz = () => {},
    onBusy = () => {},
    log = () => {},
    getLastPtz = () => null,
  } = opts;
  mount.innerHTML = TEMPLATE;
  applyI18n(mount);
  const q = (sel) => mount.querySelector(sel);
  const stepEl = q('[data-role="step"]');
  const speedEl = q('[data-role="speed"]');
  const step = () => Number(stepEl.value) || 0;
  const speed = () => {
    const s = normalizeSpeed(speedEl.value);
    if (s !== undefined) speedEl.value = s;
    return s;
  };

  async function nudge(dPan, dTilt, dZoom) {
    onBusy(true);
    try {
      const j = await postJson(`${apiBase}/ptz/nudge`, { dPan, dTilt, dZoom, speed: speed() });
      // 상대 이동만 되는 계열은 돌려줄 자세가 없다(ptz: null) — 없는 좌표를 지어내지 않고
      // 무엇을 보냈는지만 남긴다. 결과는 화면으로 확인하는 것이 이 계열의 정상 동작이다.
      if (j.relative) { log(t("상대 이동") + " → " + (j.sent || []).join(", ")); return; }
      onPtz(j.ptz);
      log(t("이동 → {p}", { p: fmtPtz(j.ptz) }));
    } catch (e) { log(t("이동 실패") + ": " + e.message); }
    finally { onBusy(false); }
  }
  mount.querySelectorAll("[data-pan]").forEach((b) => b.addEventListener("click", () => nudge(Number(b.dataset.pan) * step(), 0, 0)));
  mount.querySelectorAll("[data-tilt]").forEach((b) => b.addEventListener("click", () => nudge(0, Number(b.dataset.tilt) * step(), 0)));
  mount.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => nudge(0, 0, Number(b.dataset.zoom) * step())));

  const absPan = q('[data-role="abs-pan"]'), absTilt = q('[data-role="abs-tilt"]'), absZoom = q('[data-role="abs-zoom"]');
  q('[data-role="abs-fill"]').addEventListener("click", () => {
    const p = getLastPtz(); if (!p) return;
    absPan.value = p.panpos; absTilt.value = p.tiltpos; absZoom.value = p.zoompos;
  });
  q('[data-role="abs-go"]').addEventListener("click", async () => {
    const panpos = Number(absPan.value), tiltpos = Number(absTilt.value), zoompos = Number(absZoom.value);
    onBusy(true);
    try {
      const moveSpeed = speed();
      const speedFields = moveSpeed === undefined ? {} : { panspeed: moveSpeed, tiltspeed: moveSpeed, zoomspeed: moveSpeed };
      const j = await postJson(`${apiBase}/ptz`, { panpos, tiltpos, zoompos, ...speedFields });
      onPtz(j.ptz);
      log(t("절대 이동 → {p}", { p: fmtPtz(j.ptz) }));
    } catch (e) { log(t("절대 이동 실패") + ": " + e.message); }
    finally { onBusy(false); }
  });

  const absoluteCard = q(".card + .card");
  if (overlay && absoluteCard) {
    absoluteCard.classList.add("ptz-absolute-card");
    absoluteCard.querySelector("h2")?.remove();
    for (const [role, labelText] of [["abs-pan", "P"], ["abs-tilt", "T"], ["abs-zoom", "Z"]]) {
      const label = absoluteCard.querySelector(`[data-role="${role}"]`)?.closest("label");
      if (label?.firstChild) label.firstChild.textContent = `${labelText} `;
    }
    overlay.stage.appendChild(absoluteCard);
    const updateOverlayVisibility = () => {
      const visible = overlay.toggle.checked;
      overlay.container.hidden = !visible;
      absoluteCard.hidden = !visible;
    };
    overlay.toggle.addEventListener("change", updateOverlayVisibility);
    updateOverlayVisibility();
  }

  function fillAbsolute(ptz = getLastPtz()) {
    if (!ptz) return;
    absPan.value = ptz.panpos;
    absTilt.value = ptz.tiltpos;
    absZoom.value = ptz.zoompos;
  }

  return { step, speed, fillAbsolute, absoluteCard };
}

function normalizeSpeed(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.max(1, Math.min(100, Math.round(n)));
}

const TEMPLATE = `
<div class="card">
  <h2>수동 조정 (이동량 step)</h2>
  <div class="row" style="margin-bottom:10px;">
    <label>step <input data-role="step" type="number" value="500" min="1" /></label>
    <label>속도 <input data-role="speed" type="number" value="50" min="1" max="100" /></label>
  </div>
  <div class="row" style="align-items:flex-start;">
    <!-- Hucoms 규약(fov-convert.mjs, cam-001 필드검증): higher tiltpos = 카메라 '아래'.
         따라서 ▲(위로 보기)=tiltpos↓=dTilt 음수, ▼(아래로 보기)=tiltpos↑=dTilt 양수. -->
    <div class="pad">
      <span></span><button data-tilt="-1">▲</button><span></span>
      <button data-pan="-1">◄</button><span></span><button data-pan="1">►</button>
      <span></span><button data-tilt="1">▼</button><span></span>
    </div>
    <div style="display:flex; flex-direction:column; gap:6px;">
      <button data-zoom="1">＋ zoom in</button>
      <button data-zoom="-1">－ zoom out</button>
    </div>
  </div>
</div>
<div class="card">
  <h2>절대 위치 이동</h2>
  <div class="row">
    <label>pan <input data-role="abs-pan" type="number" min="0" max="35999" /></label>
    <label>tilt <input data-role="abs-tilt" type="number" min="-2000" max="9000" /></label>
    <label>zoom <input data-role="abs-zoom" type="number" min="0" max="65535" /></label>
    <button data-role="abs-go">이동</button>
    <button data-role="abs-fill">채우기</button>
  </div>
</div>`;
