<div align="center">

<img src="assets/brand/joe-browser.svg" alt="Joe Browser logo" width="72" height="72" />

# Joe Browser 2.0

**A focused Material UI workspace for isolated browser profiles on Windows, Android and the web.**

[![CI](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/actions/workflows/ci.yml/badge.svg)](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/pritamsarkar711/Joe-Anti-Detect-Browser?label=release)](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-D81B60.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-D81B60)](#download)

[Download EXE & APK](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/releases/latest) · [Live control plane](https://joe-browser-control.vercel.app) · [Validation](docs/VALIDATION.md) · [Architecture](docs/ARCHITECTURE.md) · [Screenshots](#screenshots)

<br/>

<img src="assets/screenshots/01-profiles-light.png" alt="Joe Browser v2 Material UI profile workspace" width="880" />

</div>

---

## What it is

Joe Browser is a source-available **profile isolation manager**. Each profile keeps its own cookies, cache, localStorage, IndexedDB, proxy and coherent fingerprint specification. The same React and Material UI workspace runs inside the Windows app, inside the Android WebView shell and on Vercel.

The Windows **EXE** and Android **APK** communicate through <img src="assets/brand/marks/supabase.svg" alt="Supabase" width="16" height="16" /> **Supabase** Realtime and Postgres. <img src="assets/brand/marks/vercel.svg" alt="Vercel" width="16" height="16" /> **Vercel** hosts this SEO site and control plane. <img src="assets/brand/marks/github.svg" alt="GitHub" width="16" height="16" /> **GitHub Actions** builds and publishes both binaries.

### Download

| Platform | File | Notes |
|---|---|---|
| <img src="assets/brand/marks/windows.svg" alt="Windows" width="18" height="18" /> Windows 10/11 | `JoeBrowser-Setup-2.0.0.exe` | NSIS installer |
| <img src="assets/brand/marks/windows.svg" alt="Windows" width="18" height="18" /> Windows 10/11 | `JoeBrowser-Portable-2.0.0.exe` | Portable, no install |
| <img src="assets/brand/marks/android.svg" alt="Android" width="18" height="18" /> Android 9+ | `JoeBrowser.apk` | Signed debug build, sideload |

Get all three from the [latest GitHub Release](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/releases/latest), together with `SHA256SUMS.txt`. Android users should enable installation from their file manager and verify the checksum before sideloading.

---

## Design system

The v2 interface follows the structure of `dunky11/react-saas-template` while adopting a stricter visual language requested for this project:

- **One primary color:** pink `#D81B60`. No secondary accent, no gradients and no dashed borders.
- **Material UI v5:** <img src="assets/brand/marks/mui.svg" alt="Material UI" width="16" height="16" /> MUI components, `responsiveFontSizes`, 8px spacing and a 2px global radius.
- **Typography:** IBM Plex Sans throughout, loaded locally from `@fontsource/ibm-plex-sans`.
- **Icons:** larger MUI Rounded icons at a 22px default, with <img src="assets/brand/marks/google.svg" alt="Google" width="16" height="16" /> style geometric clarity and circular containers where useful.
- **Official marks:** <img src="assets/brand/marks/windows.svg" alt="Windows" width="16" height="16" /> Windows, <img src="assets/brand/marks/android.svg" alt="Android" width="16" height="16" /> Android, <img src="assets/brand/marks/chrome.svg" alt="Chrome" width="16" height="16" /> Chrome, <img src="assets/brand/marks/apple.svg" alt="Apple" width="16" height="16" /> Apple, <img src="assets/brand/marks/linux.svg" alt="Linux" width="16" height="16" /> Linux, <img src="assets/brand/marks/github.svg" alt="GitHub" width="16" height="16" /> GitHub, <img src="assets/brand/marks/supabase.svg" alt="Supabase" width="16" height="16" /> Supabase and <img src="assets/brand/marks/vercel.svg" alt="Vercel" width="16" height="16" /> Vercel are shipped as local official SVG marks. All names and marks belong to their owners.
- **Circular flags:** country references use circular national flags from `flag-icons`. For example, <img src="assets/brand/flags/bd.svg" alt="Bangladesh flag" width="16" height="16" /> Bangladesh is matched to `Asia/Dhaka`, `bn-BD` and local language order.
- **HD responsive:** verified at high device pixel ratios on five Android families. No horizontal overflow, clipped controls or overlapping tap targets were left unfixed.
- **Less text:** duplicate headings, repeated buttons, unused copy and decorative clutter were removed. The interface uses short labels, clear hierarchy and generous spacing.

---

## Features

- **Unlimited isolated profiles** with deterministic IDs, groups, tags, status, notes, start URL, cookies, extensions and per-profile launch data.
- **29 observed-device bundles** derived from Apache-2.0 Apify/BrowserForge data. Samples with HeadlessChrome brands, stale Client Hints, desktop touch points or mobile profiles without touch are rejected.
- **Coherent fingerprint specs**: User-Agent, Client Hints, platform, GPU, screen, DPR, CPU, RAM, fonts, timezone, locale, languages, WebRTC mode and touch points are derived together.
- **30 region presets** with DST-correct timezone offsets and proxy-to-locale matching. Example: <img src="assets/brand/flags/bd.svg" alt="Bangladesh flag" width="16" height="16" /> Bangladesh, <img src="assets/brand/flags/us.svg" alt="United States flag" width="16" height="16" /> United States, <img src="assets/brand/flags/gb.svg" alt="United Kingdom flag" width="16" height="16" /> United Kingdom, <img src="assets/brand/flags/de.svg" alt="Germany flag" width="16" height="16" /> Germany and <img src="assets/brand/flags/jp.svg" alt="Japan flag" width="16" height="16" /> Japan.
- **Quality metrics**: per-profile consistency, uniqueness, entropy, grade, real-backed status and distinct-bundle accounting. Current measured workspace consistency is 100%; measured uniqueness is 77% with grade B. No perfect external score is claimed.
- **Local JavaScript probe**: `22 of 22` internal checks pass for the bundled payload. The app links to independent detectors including IP Fighter, Pixelscan, IPHey, AmIUnique, CreepJS and BrowserLeaks for testing inside a launched native profile.
- **Import and transfer**: JSON workspace import/export, CSV profile import/export, cookie JSON or `name=value` import, and per-profile proxy parsing.
- **Proxy manager**: HTTP, HTTPS, SOCKS4 and SOCKS5, bulk paste, country tags, assignment and simulated health checks.
- **Bulk operations**: create, duplicate, launch, stop, export and delete without an artificial cap; 250-profile creation is covered by the browser smoke suite.
- **Desktop and Android sync**: Supabase Realtime commands, RLS-scoped Postgres state, event log, device presence and a desktop-to-Android command action.
- **Local REST API**: the Windows app serves loopback endpoints for health, profiles, launch, quality, surfaces and injection script inspection.
- **Validation views**: quality, observed data, JS surfaces, geo presets and explicit engine-level limits are visible in the app rather than hidden.

---

## Screenshots

| Profiles | Create | Detail |
|---|---|---|
| ![Profiles](assets/screenshots/01-profiles-light.png) | ![Create](assets/screenshots/03-create-profile.png) | ![Detail](assets/screenshots/02-profile-detail.png) |

| Fingerprints | Live probe | Devices |
|---|---|---|
| ![Fingerprints](assets/screenshots/07-fingerprints.png) | ![Live probe](assets/screenshots/08b-leak-check-result.png) | ![Devices](assets/screenshots/06-devices-sync.png) |

| Proxies | Activity | Settings |
|---|---|---|
| ![Proxies](assets/screenshots/05-proxies.png) | ![Activity](assets/screenshots/09-activity.png) | ![Settings](assets/screenshots/10-settings.png) |

| Light theme | Dark theme | Command palette |
|---|---|---|
| ![Light](assets/screenshots/01-profiles-light.png) | ![Dark](assets/screenshots/11-profiles-dark.png) | ![Palette](assets/screenshots/04-command-palette.png) |

### Mobile matrix

| <img src="assets/brand/marks/google.svg" alt="Google" width="18" height="18" /> Pixel | <img src="assets/brand/marks/xiaomi.svg" alt="Xiaomi" width="18" height="18" /> Xiaomi | <img src="assets/brand/marks/samsung.svg" alt="Samsung" width="18" height="18" /> Samsung | <img src="assets/brand/marks/oppo.svg" alt="OPPO" width="18" height="18" /> OPPO | <img src="assets/brand/marks/vivo.svg" alt="Vivo" width="18" height="18" /> Vivo |
|---|---|---|---|---|
| ![Pixel](assets/screenshots/devices/google-pixel-profiles.png) | ![Xiaomi](assets/screenshots/devices/xiaomi-profiles.png) | ![Samsung](assets/screenshots/devices/samsung-galaxy-profiles.png) | ![OPPO](assets/screenshots/devices/oppo-profiles.png) | ![Vivo](assets/screenshots/devices/vivo-profiles.png) |

All screenshots are captured from the running app by `npm run screenshots` and `npm run test:devices`. The device report is at [`assets/screenshots/devices/report.json`](assets/screenshots/devices/report.json).

---

## Stack

| Layer | Technology |
|---|---|
| Shared core | <img src="assets/brand/marks/typescript.svg" alt="TypeScript" width="16" height="16" /> TypeScript: profiles, presets, geo, quality, consistency, transfer, sync |
| Shared UI | <img src="assets/brand/marks/react.svg" alt="React" width="16" height="16" /> React 18 + <img src="assets/brand/marks/vite.svg" alt="Vite" width="16" height="16" /> Vite + <img src="assets/brand/marks/mui.svg" alt="Material UI" width="16" height="16" /> MUI 5 |
| Desktop | <img src="assets/brand/marks/electron.svg" alt="Electron" width="16" height="16" /> Electron 33 + `electron-builder` + local REST API |
| Android | <img src="assets/brand/marks/android.svg" alt="Android" width="16" height="16" /> Java / WebView, per-process data dirs, JS bridge, PostgREST sync |
| Backend | <img src="assets/brand/marks/supabase.svg" alt="Supabase" width="16" height="16" /> Supabase: Postgres, Auth, RLS, Realtime, Edge Functions |
| Hosting | <img src="assets/brand/marks/vercel.svg" alt="Vercel" width="16" height="16" /> Vercel static SEO site |
| Build | <img src="assets/brand/marks/github.svg" alt="GitHub" width="16" height="16" /> GitHub Actions: Windows EXE, Android APK, checksums and release |

```text
packages/core          profile model, 29 observed samples, 30 geo presets, quality
packages/fingerprint   JS consistency payload and local self-test hooks
packages/sync          transport-agnostic EXE ↔ APK sync + Supabase adapter
src/                   MUI workspace: seven views, shell, command palette, toasts
apps/desktop           Electron main, preload, REST API and builder config
apps/android           Java sources, manifest, resources and APK build script
supabase/              SQL migration
site/                  SEO landing page with local fonts, marks, flags and screenshots
docs/                  architecture, validation and IP protection policy
.github/workflows/     CI + binary release pipeline
```

---

## Quick start

```bash
npm install
npm run dev                 # live control plane on http://localhost:5173
npm test                    # 29 unit and SSR tests
npm run test:fingerprint    # 29/29 injection self-tests + workspace quality
npm run test:ui             # 31 real-browser checks, needs the dev server
npm run test:devices        # 75 checks across five mobile devices, needs dev server
npm run test:java           # Java source parser check
npm run test:site           # static SEO site checks
npm run build               # typecheck + production bundle
npm run screenshots         # regenerate real screenshots
npm run build:core          # bundle the shared TS core for native shells
npm run build:android-ui && npm run build:assets
npm run build:site          # static SEO site
```

Native binaries are built in GitHub Actions, not committed to Git. The release workflow bundles the shared core, builds the Android UI and assets, builds the NSIS and portable EXEs on Windows, compiles and signs the APK on Ubuntu, then publishes a GitHub Release with `SHA256SUMS.txt`. See [`docs/VALIDATION.md`](docs/VALIDATION.md) for the exact current test results and environment limits.

---

## Scope, honestly

Joe Browser is built for **legitimate privacy research, QA/testing, ad verification and separation of your own accounts**. It removes linkability between local sessions and keeps JavaScript-visible fingerprint surfaces internally consistent.

It is **not undetectable**, and no browser honestly is. Commercial AdsPower/GoLogin/Dolphin-tier products and projects such as Donut, ShardBrowser, Camoufox and OVO patch Chromium or Firefox at the C++ engine level. Joe Browser does **not** ship a patched engine. TLS/JA4, HTTP/2 frame order, QUIC, font rasterisation, GPU driver behaviour and CDP side channels come from stock Electron Chromium or Android WebView. Those engine-level surfaces are listed explicitly in the app, in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and in [`docs/VALIDATION.md`](docs/VALIDATION.md).

Independent detector hosts were unreachable from this sandbox (`net::ERR_CONNECTION_CLOSED`), so no third-party detector score is claimed. Open the detector links inside a launched native profile and compare proxy exit location, timezone, locale, WebRTC and Client Hints yourself. We will not add fraud, enforcement evasion, ban evasion or impersonation features.

---

## License, copyright and brand

The source code is MIT licensed. Copyright © 2026 Pritam Sarkar and contributors. See [`LICENSE`](LICENSE), [`NOTICE`](NOTICE) and [`TRADEMARK.md`](TRADEMARK.md).

A public MIT grant permits source forks with attribution. It cannot legally ban copying or redistribution. To protect identity and provenance, brand assets and written documentation are governed separately, every official mark is attributed, releases carry checksums and build provenance, contributors certify ownership under a DCO, and false ownership or endorsement claims are expressly prohibited. The full practical strategy is in [`docs/IP-POLICY.md`](docs/IP-POLICY.md). Third-party names and marks belong to their respective owners and are used for identification only.
