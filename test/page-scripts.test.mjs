import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { parseAst } from "vite";

const root = new URL("../", import.meta.url);

// 왜 이 테스트가 있는가 — 2026-08-11 6630082 이 설정 탭의 카메라 목록을 걷어내면서
// `const simSetStatus = ...` 선언만 지우고 읽는 곳 두 군데를 남겼다. 페이지 본문은
// <script type="module"> = strict mode 라, 미선언 식별자는 **읽는 순간** ReferenceError 다.
// 남아 있던 코드가 `if (!silent && simSetStatus) ...` 였다는 것이 이 병의 핵심이다 —
// 방어처럼 생겼지만 `&& simSetStatus` 가 바로 그 throw 다. 그래서 리뷰를 통과했고,
// 11일 뒤 「시뮬레이터가 연결되지 않습니다」로 보고됐다(실제로는 백엔드가 붙어 있었다).
//
// 문자열 검색으로는 못 잡는다(`X && X.foo` 는 어디에나 있는 정상 관용구다). 그래서 진짜
// AST 로 바인딩과 참조를 갈라 본다. parseAst 는 vite 가 다시 내보내는 rollup 파서라
// 새 의존성이 없다 — 어차피 빌드가 같은 파서로 이 파일들을 읽는다.

// 바인딩 수집은 **평면(flat)** 이다: 블록 스코프를 재현하지 않고, 모듈 안 어디서든 선언된
// 이름이면 선언된 것으로 친다. 일부러 그렇게 뒀다 — 오탐이 하나라도 나면 이 테스트는
// 「고치는 대신 예외를 추가하는」 테스트가 되어 버린다. 이 그물이 잡는 것은 **선언이 통째로
// 사라진** 경우이고, 그것이 실제로 우리를 문 부류다. TDZ·섀도잉까지는 보지 않는다.
function bindingsOf(node, add) {
  if (!node) return;
  switch (node.type) {
    case "Identifier": add(node.name); break;
    case "ObjectPattern":
      for (const p of node.properties) bindingsOf(p.type === "RestElement" ? p.argument : p.value, add);
      break;
    case "ArrayPattern": for (const e of node.elements) bindingsOf(e, add); break;
    case "AssignmentPattern": bindingsOf(node.left, add); break;
    case "RestElement": bindingsOf(node.argument, add); break;
  }
}

// 식별자 노드가 **참조가 아닌** 자리들. 여기를 빼먹으면 `obj.foo` 의 foo, `{ foo: 1 }` 의
// 키, `import { fmtPtz as fmt }` 의 fmtPtz 가 전부 미선언 참조로 잡힌다(실제로 겪었다).
function isReference(n, parent) {
  if (!parent) return true;
  if (parent.type === "MemberExpression" && parent.property === n && !parent.computed) return false;
  if (parent.type === "Property" && parent.key === n && !parent.computed) return false;
  if (parent.type === "MethodDefinition" && parent.key === n && !parent.computed) return false;
  if (parent.type === "PropertyDefinition" && parent.key === n && !parent.computed) return false;
  if (parent.type === "ImportSpecifier" && parent.imported === n) return false;
  if (parent.type === "ExportSpecifier") return false;
  if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") return false;
  return true;
}

function undeclaredIn(src) {
  const ast = parseAst(src, { sourceType: "module" });
  const binds = new Set(), refs = new Set();
  const walk = (n, parent) => {
    switch (n.type) {
      case "VariableDeclarator": bindingsOf(n.id, (x) => binds.add(x)); break;
      case "FunctionDeclaration": case "ClassDeclaration":
      case "FunctionExpression": case "ArrowFunctionExpression":
        if (n.id) binds.add(n.id.name); break;
      case "CatchClause": bindingsOf(n.param, (x) => binds.add(x)); break;
      case "ImportDefaultSpecifier": case "ImportNamespaceSpecifier": case "ImportSpecifier":
        binds.add(n.local.name); break;
    }
    if (n.params) for (const p of n.params) bindingsOf(p, (x) => binds.add(x));
    if (n.type === "Identifier" && isReference(n, parent)) refs.add(n.name);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") walk(c, n); }
      else if (v && typeof v.type === "string") walk(v, n);
    }
  };
  walk(ast, null);
  return [...refs].filter((r) => !binds.has(r) && !ALLOWED.has(r));
}

// 표준 내장(Array·Math·JSON·fetch·NaN·undefined…)은 node 의 전역에서 그대로 얻는다 —
// 손으로 베끼면 그 목록이 먼저 낡는다. 브라우저에만 있는 것만 명시한다. 페이지가 새 DOM
// 전역을 쓰기 시작하면 이 목록에 한 줄 늘리면 되고, **그 한 줄을 늘리는 행위 자체가**
// 「이건 전역이 맞다」는 판단을 남긴다.
const DOM_GLOBALS = [
  "window", "document", "location", "localStorage", "sessionStorage", "navigator", "history",
  "Event", "CustomEvent", "Node", "NodeFilter", "Option", "Image", "DOMPoint", "HTMLElement",
  "requestAnimationFrame", "cancelAnimationFrame", "createImageBitmap",
  "alert", "confirm", "prompt", "getComputedStyle", "matchMedia",
];
const ALLOWED = new Set([...Object.getOwnPropertyNames(globalThis), ...DOM_GLOBALS]);

async function pageModules() {
  const out = [];
  for (const f of (await readdir(new URL("public/", root))).filter((f) => f.endsWith(".html"))) {
    const html = await readFile(new URL(`public/${f}`, root), "utf8");
    let i = 0;
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) out.push([`public/${f}#${i++}`, m[1]]);
  }
  return out;
}

test("페이지 인라인 모듈에 선언 없이 읽는 식별자가 없다", async () => {
  const mods = await pageModules();
  assert.ok(mods.length >= 5, "페이지 모듈을 못 찾았다 — 추출 정규식이 낡았다");
  for (const [where, src] of mods) {
    assert.deepEqual(undeclaredIn(src), [], `${where}: strict mode 에서 읽는 즉시 ReferenceError 다`);
  }
});

test("src 모듈에도 같은 그물을 친다", async () => {
  // .jsx 는 이 파서가 못 읽는다(JSX 문법). 번들러가 어차피 붙잡으므로 .mjs 만 본다.
  const files = (await readdir(new URL("src/", root), { recursive: true }))
    .filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"));
  assert.ok(files.length >= 5, "src 모듈을 못 찾았다");
  for (const f of files) {
    const src = await readFile(new URL(`src/${f}`, root), "utf8");
    assert.deepEqual(undeclaredIn(src), [], `src/${f}: 선언 없이 읽는 식별자`);
  }
});
