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
ecosystem.config.cjs # pm2 — 개발기 상주용. 앱 이름 calory-ui. 설정값은 두지 않는다(.env 가 출처)
.env             # gitignore. server.mjs 가 loadEnvFile 로 직접 읽는다 (.env.example 이 표본)
pnpm-workspace.yaml  # workspace 가 아니라 pnpm 설정용(allowBuilds) — pnpm 11 이 여기서 읽는다
.nojekyll        # Pages 가 밑줄로 시작하는 경로를 산출물에서 빼지 않게 한다
```

**원본에서 빼고 온 것**(공개 저장소 판단):

- `public/_compare/`(8.2MB UE 화질 비교 렌더)와 `public/compare.html` — 내부 개발 부산물이고
  본문에 실명 인용이 있었다. 덕분에 저장소가 8.8MB → 560KB 가 됐다.

## Entrypoints and key modules

- 브라우저 진입: 정적 사이트 루트. Pages 에서는 저장소 이름이 base path 가 된다.
- 페이지 레지스트리: `src/pages.mjs` — 헤더 nav·버전 배지·홈 카드가 전부 이 표 하나를 본다.
  페이지를 추가할 때 **손으로 맞춰야 하는 미러는 둘뿐이다** — `server.mjs` 의 `PAGE_ROUTES`·
`PAGE_REDIRECTS` 와 `styles/tailwind.css` 의 `@source`. `pack.mjs` 는 `PAGES` 에서 파생시키므로
건드리지 않는다(테스트가 그 파생을 잡고 있다).
- API 계약: `src/api.mjs` — base 주입 체인이 여기 있다(`memo.md` 참조).
- **페이지 로직은 `public/<페이지>.html` 안의 인라인 `<script type="module">` 에 있다** —
  `src/` 에는 공용 모듈만 있고 페이지별 JS 파일은 없다. 그래서 페이지 하나가 크다
  (`calibration.html`·`simulator.html` 이 수천 줄). 페이지를 고칠 때 찾을 곳은 그 HTML 이다.
- **페이지는 공용 모듈을 `./web/api.mjs` 형태로 import 한다** — `server.mjs` 가 `/web/` 을
  `src/` 로 서빙하고 `pack.mjs` 가 `dist/web/` 로 배치한다. `./src/` 로 쓰면 붙지 않는다.
- 공용 모듈(`src/*.mjs`): `api` · `camera-preview` · `camera-select` · `i18n` ·
  `mjpeg-player` · `motion-settle` · `page-chrome` · `pages` · `profile-chart` ·
  `ptz-controls` · `theme`.
- **테스트가 두 자리에 있다** — `test/*.test.mjs` 와 소스 옆 `src/*.test.mjs`
  (`mjpeg-player` · `motion-settle`). `pnpm test` 가 두 글로브를 모두 돈다.
- 페이지별 버전은 `public/app-versions.json`, 패키지 버전은 `package.json` — 화면에 바뀐 것이
  있으면 둘을 함께 올린다. **숫자를 문서에 복사하지 않는다**(반드시 낡는다).

## Build and validation commands

```bash
pnpm install
pnpm build          # Tailwind CLI — public/app.css 생성 (gitignore 산출물, clone 후 1회 필수)
pnpm test           # node:test
pnpm build:dist     # 정적 호스트용 dist (Pages 배포 산출물)
```

개발기 상주(pm2):

```bash
pm2 start ecosystem.config.cjs && pm2 save   # 앱 이름 calory-ui
pm2 resurrect                                # 재부팅 후 — Windows 는 부팅 훅이 없다(memo.md)
pm2 logs calory-ui --lines 30
```

- `public/app.css` 는 **gitignore 산출물**이다. 빌드하지 않으면 UI 가 무스타일로 나온다.
- `pnpm watch:css` 는 그대로 돌지 않는다 — `pnpm-workspace.yaml` 의 `allowBuilds` 가
  `@parcel/watcher: false` 로 네이티브 워처 빌드를 스킵해 둔다(어느 머신에서든 `pnpm install` 이
  통과하게 하려는 의도적 선택). 워처가 필요하면 그 값을 `true` 로 바꾼다. 1회성 `build:css` 는
  영향 없다.
- `pnpm test` 는 **두 글로브**를 돈다 — `test/**` 와 `src/**`. 소스 옆 테스트를 빠뜨리지 않는다.
- Pages 배포는 `main` push → `.github/workflows/pages.yml`(`pnpm test` → `pnpm build:dist` →
  `dist/` 발행). 저장소 Settings → Pages → Source 를 "GitHub Actions" 로 둬야 한다.
- pm2 로 올린 것과 `pnpm start` 는 **같은 포트를 다툰다**. pm2 에 올려 둔 채 `pnpm start` 를
  치면 `EADDRINUSE` 다 — 어느 쪽이 8180 을 잡고 있는지 `pm2 list` 로 먼저 본다.

## Tests

- `node:test` 기반. 실기·네트워크 불필요.
- TODO: 모노레포에서 분리되며 버전 정합 테스트의 대상 범위가 바뀐다 — `plan.md` 참조.

## Notes

- **도메인 수식이 없다.** 화각·투영·조준은 전부 백엔드가 계산해 값으로 내려준다.
  광학 모델을 이 저장소에 두면 두 벌로 갈라져 조용히 틀린 곳을 그린다.
- **무번들 바닐라.** 빌드는 Tailwind 하나뿐이고 JS 번들러가 없다(유지 결정).
- 백엔드가 광학을 선언하지 않은 기기에서는 화각 값이 **응답에 아예 없다** — 그 값을 쓰는
  화면은 없을 때를 반드시 처리해야 한다. 기본 곡선으로 대신 채우면 조용히 틀린다.
