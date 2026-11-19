# OPEN_SOURCE_RESEARCH — Joe Browser

Phase 20 deliverable: candidate open-source projects evaluated before building
or adopting components, with license, maintenance, dependency and security
posture, and the adoption decision. Evaluation date 2026-11-19; "last update"
refers to activity observed at evaluation time.

## Adopted (in the dependency tree)

| Project | License | Why adopted | Posture check | Decision |
|---|---|---|---|---|
| `mui/material` + `@mui/icons-material` v5 | MIT | The spec's Material Design requirement; mature, typed, tree-shakeable | Very active; advisory history promptly patched; 0 audit findings in tree | **Adopt** for the whole design system |
| `@emotion/*` | MIT | Required by MUI 5 styling | Active; no findings | **Adopt** (transitively required) |
| `@fontsource/ibm-plex-sans` | MIT (font: OFL) | Spec: IBM Plex Sans, self-hosted (no font CDN) | Static packaging of upstream IBM Plex (OFL-1.1, attribution in NOTICE pattern) | **Adopt** |
| `flag-icons` | MIT | Circular country flags as data URIs, no runtime stylesheet | Active, no findings | **Adopt** |
| `simple-icons` | CC0-1.6 | Official brand marks for third-party browsers/services (spec: official logos only) | Active; marks are trademarks of their owners — usage is nominative, stated in TRADEMARK.md | **Adopt** with trademark notice |
| `react`/`react-dom` 18 | MIT | UI runtime | Active | **Adopt** |
| `vite`/`@vitejs/plugin-react` | MIT | Build tooling | Active; esbuild transitive kept ≥0.25 via lockfile | **Adopt** |
| `vitest` | MIT | Test runner (upgraded 3→5 to clear `@vitest/mocker`/`tinypool` advisories) | Active | **Adopt** at ≥5.1 |
| `esbuild` | MIT | Core bundling for native shells (upgraded 0.24→0.28 for dev-server advisory) | Active | **Adopt** at ≥0.28 |
| `java-parser` | MIT (deps: chevrotain MIT, lodash) | CI-only Java syntax gate for the Android sources | Semi-active; lodash advisory mitigated by `overrides` to 4.18.1 | **Adopt** with override, CI-only scope (never shipped, parses first-party sources only) |
| `playwright-core` + `@sparticuz/chromium` | Apache-2.0 | Real-browser UI/device tests and screenshots in CI | Both active; Chromium binary is a build-time artifact | **Adopt** (dev-only) |
| `@electron/asar` | MIT | Decided *against* runtime use — `scripts/check-asar.mjs` reads archive headers directly (dependency-free, per its own history) | — | **Reference only** |
| `electron` 33 / `electron-builder` | MIT / Apache-2.0 | Desktop shell + Windows packaging | Chromium security track record; kept current in `apps/desktop` | **Adopt** |
| `@supabase/supabase-js` | MIT | Desktop shell Realtime channel only (the web UI deliberately uses plain fetch to keep the bundle lean) | Active | **Adopt** in `apps/desktop` only |
| Apify/BrowserForge-style observed fingerprint dataset | Apache-2.0 | 29 real-device samples behind `packages/core/src/data/realFingerprints.ts` | Static data; attribution in NOTICE and `FINGERPRINT_DATA_SOURCE` | **Adopt** with attribution (spec: do not copy without license check) |
| `dunky11/react-saas-template` | MIT | Structural reference for the workspace layout (credited in README) | Archived-ish template; design language diverged per spec | **Structure reference only** — no code copied verbatim |

## Evaluated and not adopted

| Project | License | Why not |
|---|---|---|
| CEF (Chromium Embedded Framework) | BSD-3 | Would satisfy "separately packaged engine" on Windows, but adds ~200 MB, a C++ toolchain and its own release cadence; Electron already embeds the same engine class. Revisit if a Firefox-class second engine becomes a hard requirement. |
| GeckoView | MPL-2.0 | The only legal path to real Firefox-family engines on Android; integrating it means a GeckoView Gradle/AAR toolchain this repo's SDK-only build cannot carry. Kept as the documented upgrade path (MPL file-level copyleft is compatible with MIT distribution of separate files). |
| Camoufox / patching approaches (Donut, ShardBrowser, etc.) | various | Engine patching is explicitly out of scope and contradicts the "no stealth automation / no deceptive spoofing" rule. Not used. |
| Puppeteer / Playwright (runtime) | Apache-2.0 | Test-only value; `playwright-core` covers it without shipping automation APIs inside the product. |
| adblock lists / uBlock Origin (vendored) | GPLv3 | GPL vendoring into an MIT app creates license coupling; the extension *catalog* links to official stores instead of bundling code. |
| supabase-js in the web bundle | MIT | Works, but ~100 KB for two auth endpoints; plain fetch client is smaller and fully unit-testable. Kept for the desktop Realtime channel where the SDK earns its weight. |
| electron-updater | MIT | Auto-update adds signing/publishing infrastructure we do not operate yet; releases are explicit downloads with SHA256SUMS. |

## Method

For each candidate: official repository → license file → latest release/
commit activity → dependency tree audit (`npm audit`, `npm ls`) → role fit →
copyleft compatibility with MIT + CC BY-ND docs → security advisory history.
No code with incompatible licenses (GPL/AGPL/SSPL) is vendored; trademarked
marks are used nominatively with attribution (`TRADEMARK.md`, `NOTICE`).
