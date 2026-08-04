# Inventory

## 목차

- [Repository](#repository)
- [Top-level structure](#top-level-structure)
- [Entrypoints and key modules](#entrypoints-and-key-modules)
- [Build and validation commands](#build-and-validation-commands)
- [Tests](#tests)
- [Notes](#notes)

## Repository

- Name: `baro_kalory`
- Path: **적지 않는다** — 체크아웃마다 다르고, 공개 저장소라 경로의 사용자명이 노출된다.
- Summary: PTZ CCTV 커미셔닝 콘솔 웹 UI. 정적 사이트(GitHub Pages)로 배포하고,
  제어 API 는 형제 저장소 `baro_calrory` 의 백엔드가 담당한다.
- 형제 저장소: `baro_calrory` — 제어 REST API, 광학·조준 기하 솔버, 카메라 드라이버.
  이 저장소는 그것을 **HTTP 로만** 호출한다.

## Top-level structure

```
public/          # 페이지 HTML · 파비콘 · app-versions.json · 빌드 산출물 app.css(gitignore)
src/             # 브라우저 ES 모듈 (api · pages · page-chrome · 프리뷰 · PTZ · 테마 · i18n)
styles/          # Tailwind 소스 (@source 는 글로브가 아니라 파일 나열)
test/            # node:test — 네트워크·실기 불필요
server.mjs       # 개발용 정적 서버 + API 프록시. 배포 경로에 없다
pack.mjs         # 재작성 규칙 없는 정적 호스트용 dist 빌더 (Pages 배포의 핵심)
pnpm-workspace.yaml  # workspace 가 아니라 pnpm 설정용(allowBuilds) — pnpm 11 이 여기서 읽는다
.nojekyll        # Pages 가 밑줄로 시작하는 경로를 산출물에서 빼지 않게 한다
```

**원본에서 빼고 온 것**(공개 저장소 판단):

- `public/_compare/`(8.2MB UE 화질 비교 렌더)와 `public/compare.html` — 내부 개발 부산물이고
  본문에 실명 인용이 있었다. 덕분에 저장소가 8.8MB → 560KB 가 됐다.

## Entrypoints and key modules

- 브라우저 진입: 정적 사이트 루트. Pages 에서는 저장소 이름이 base path 가 된다.
- 페이지 레지스트리: `src/pages.mjs` — 헤더 nav·버전 배지·홈 카드가 전부 이 표 하나를 본다.
  페이지를 추가하면 여기와 `styles/tailwind.css` 의 `@source`, `pack.mjs` 를 함께 고친다.
- API 계약: `src/api.mjs` — base 주입 체인이 여기 있다(`memo.md` 참조).
- TODO: 이전 후 실제 파일 목록으로 확정한다.

## Build and validation commands

```bash
pnpm install
pnpm build          # Tailwind CLI — public/app.css 생성 (gitignore 산출물, clone 후 1회 필수)
pnpm test           # node:test
pnpm build:dist     # 정적 호스트용 dist (Pages 배포 산출물)
```

- `public/app.css` 는 **gitignore 산출물**이다. 빌드하지 않으면 UI 가 무스타일로 나온다.
- TODO: Pages 배포 워크플로(GitHub Actions)를 정하면 여기 기록한다.

## Tests

- `node:test` 기반. 실기·네트워크 불필요.
- TODO: 모노레포에서 분리되며 버전 정합 테스트의 대상 범위가 바뀐다 — `plan.md` 참조.

## Notes

- **도메인 수식이 없다.** 화각·투영·조준은 전부 백엔드가 계산해 값으로 내려준다.
  광학 모델을 이 저장소에 두면 두 벌로 갈라져 조용히 틀린 곳을 그린다.
- **무번들 바닐라.** 빌드는 Tailwind 하나뿐이고 JS 번들러가 없다(유지 결정).
- 백엔드가 광학을 선언하지 않은 기기에서는 화각 값이 **응답에 아예 없다** — 그 값을 쓰는
  화면은 없을 때를 반드시 처리해야 한다. 기본 곡선으로 대신 채우면 조용히 틀린다.
