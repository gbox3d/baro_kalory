// 등록이 관문이다 — 관제 헤더 셀렉터(cctv·calibration·discovery·height 공유)에는 등록된
// 카메라만 선다. /cctv/devices 는 등록 기기 뒤에 씬 카메라(registered:false)를 병합해
// 보내는데, 씬 카메라도 현실 어딘가에 설치된 카메라다 — 등록 없이 관제 화면에 노출되면
// 규정 위반이고, 셀렉터에서 고르는 행위가 곧 영구 등록이 되는 부작용까지 있다(2026-08-17).
import assert from "node:assert/strict";
import test from "node:test";

// import 전에 심어야 한다(i18n 이 모듈 스코프에서 document.title 을 읽는다).
globalThis.document = { title: "test", addEventListener() {}, querySelector: () => null };
globalThis.window = { addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.Option = class {
  constructor(text, value) { this.text = text; this.value = value; }
};

const { createCameraSelect } = await import("../src/camera-select.mjs");

function makeSelect() {
  return {
    options: [],
    disabled: false,
    value: "",
    title: "",
    replaceChildren(...nodes) { this.options = nodes; },
    appendChild(node) { this.options.push(node); return node; },
    addEventListener() {},
  };
}

test("미등록(registered:false) 씬 카메라는 셀렉터에 서지 않는다", () => {
  const select = makeSelect();
  const cam = createCameraSelect({ select });
  cam.sync([
    { id: "cam-real-001", name: "실기 01", registered: true },
    { id: "ref-ptz", name: "기준기", mode: "sim", registered: true },
    { id: "sim-cam-8030", name: "씬 카메라", mode: "sim", registered: false },
  ], "cam-real-001");
  assert.deepEqual(select.options.map((o) => o.value), ["cam-real-001", "ref-ptz"]);
  assert.deepEqual(cam.list().map((d) => d.id), ["cam-real-001", "ref-ptz"]);
});

test("registered 표식이 없는 응답(구 백엔드)은 전부 등록으로 취급한다", () => {
  const select = makeSelect();
  const cam = createCameraSelect({ select });
  cam.sync([{ id: "a", name: "A" }, { id: "b", name: "B" }], "b");
  assert.deepEqual(select.options.map((o) => o.value), ["a", "b"]);
  assert.equal(cam.activeId(), "b");
});

test("서버가 active 로 지목한 기기는 미등록이어도 남는다 — 딴 카메라를 활성이라 말하지 않는다", () => {
  const select = makeSelect();
  const cam = createCameraSelect({ select });
  cam.sync([
    { id: "cam-real-001", name: "실기 01", registered: true },
    { id: "sim-cam-8030", name: "씬 카메라", registered: false },
  ], "sim-cam-8030");
  assert.deepEqual(select.options.map((o) => o.value), ["cam-real-001", "sim-cam-8030"]);
  assert.equal(cam.activeId(), "sim-cam-8030");
});

test("필터 결과가 0대면 '등록된 CCTV 없음' 으로 잠긴다", () => {
  const select = makeSelect();
  const cam = createCameraSelect({ select });
  cam.sync([{ id: "sim-cam-8030", name: "씬 카메라", registered: false }], null);
  assert.equal(select.options.length, 1);
  assert.equal(select.options[0].value, "");
  assert.equal(select.disabled, true);
  assert.equal(cam.activeId(), null);
});
