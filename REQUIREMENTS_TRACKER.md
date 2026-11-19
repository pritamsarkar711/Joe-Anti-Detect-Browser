# REQUIREMENTS_TRACKER — Joe Browser 3.2.0

Requirement-by-requirement status against the product spec. Statuses:
**COMPLETE AND VERIFIED** (C+V), **IMPLEMENTED BUT NOT VERIFIED** (I),
**PARTIALLY IMPLEMENTED** (P), **MISSING** (M), **BROKEN** (B — fixed where
marked ✔), **BLOCKED BY TECHNICAL LIMITATION** (BL).

Test procedure column names the command a human or CI runs; verification
column records what that produced on 2026-11-19.

## Startup and stability (Phase 3)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-3.1 | No permanent blank screen; error boundary | `src/ui/ErrorBoundary.tsx`, `src/boot.tsx` | C+V | `npm run test:ui-desktop` | renderer boots from `file://` with no console errors; failure shows an error surface |
| T-3.2 | Packaged app boots (no missing modules) | `scripts/check-packaged.mjs`, `scripts/check-desktop.mjs` | C+V | `npm run test:packaged`, `npm run test:desktop` | 4/4 + 11/11; removing chrome.html or extensions.cjs from `build.files` fails the gate |
| T-3.3 | Second launch focuses, single instance | `apps/desktop/main.js` | C+V | `npm run test:main` | single-instance lock verified at boot |
| T-3.4 | GPU fallback switch | `JOE_DISABLE_GPU`, `--disable-gpu` | I | manual on Windows | code inspected; needs Windows hardware |
| T-3.5 | Version surfaces agree | `tests/version.test.ts` | C+V | `npm test` | shell/Android/site/manifest all pinned to package.json (was B: shell said 3.1.0) |

## Engine and profiles (Phases 4–5)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-4.1 | No dependency on host Chrome/Firefox/Edge | `apps/desktop/main.js`, `extensions.cjs` | C+V | code inspection + `test:main` | engine = Electron Chromium / Android WebView; no host profile paths read |
| T-4.2 | Five engines as distributions | — | P | — | five *configurations* on bundled engines; no Gecko binary. Documented honestly in README "Scope, honestly" |
| T-5.1 | Profile CRUD + duplicate/rename/tags/notes | `src/state/store.tsx`, `test:main` | C+V | `npm run test:main` | create/update/delete round-trip, bulk create verified |
| T-5.2 | Import/export JSON + CSV | `packages/core/src/transfer.ts` | C+V | `npm run test:main` | export/import round-trips (6 profiles) |
| T-5.3 | Storage isolation per profile | session partitions (desktop), data-dir suffix (Android) | I | engine primitive; manual cross-profile cookie check on device | partition/suffix verified in launch code (`test:main` asserts `persist:<id>` sessions) |
| T-5.4 | Search/filter/group/status/timestamps | `ProfilesView.tsx` | C+V | `npm run test:ui` | covered by UI checks |

## Fingerprints (Phase 6)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-6.1 | Coherent UA/CH/screen/GPU/tz/locale/WebRTC specs | `packages/core`, `packages/fingerprint` | C+V | `npm run test:fingerprint` | 29/29 self-tests; 100% workspace consistency |
| T-6.2 | Stable per profile, not per page load | `noiseSeed` per profile | C+V | `tests/v2.test.ts` | deterministic per seed |
| T-6.3 | No undetectability claims | copy + `test:site` | C+V | `npm run test:site` | gate fails on overclaims |
| T-6.4 | Documented engine-level limits | `docs/ARCHITECTURE.md`, Tests view | C+V | inspection | TLS/JA4, QUIC, fonts, GPU listed as engine-controlled |

## Proxy (Phase 7)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-7.1 | HTTP/HTTPS/SOCKS4/SOCKS5 parse + assign | `packages/core/src/proxy.ts` | C+V | `npm test`, `test:main` | parse/import verified |
| T-7.2 | Test connection, offline/recovery/rotation alerts | `store.tsx` proxy monitor | C+V | `tests/v2.test.ts` + UI | transition-based notifications verified in code path tests |
| T-7.3 | Proxy per profile, no password in logs/UI | `main.js` `proxyFor` | C+V | inspection | credentials only in session config; UI shows host:port |

## Extensions (Phase 8)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-8.1 | Catalog, search, details, store links | `packages/core/src/extensions.ts`, `ExtensionsView.tsx` | C+V | `npm test`, `test:ui` | 12 real entries, family store links |
| T-8.2 | Install/remove/enable (desktop, unpacked) | `extensions.cjs` | C+V | `npm run test:main` | zip-slip refusal, digest, manifest validation verified |
| T-8.3 | No silent installs; signed-CRX limits stated | `ExtensionsView.tsx`, module docs | C+V | inspection | store-link fallback is explicit |

## History and browser controls (Phase 9)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-9.1 | History records every visit per profile | `main.js` attachHistory, `BrowserActivity.recordHistory`, `core/history.ts` | C+V ✔ | `npm test` + `npm run test:main` | was B (no recorder existed); now entries stream with title refresh, search flag, dedupe |
| T-9.2 | History list: title/URL/date/time, copy, open, delete, clear, search, filter | `HistoryView.tsx` | C+V | `npm run test:ui` | covered |
| T-9.3 | Controls: back/forward/reload/home/address/find/zoom/bookmarks/downloads | `chrome.html` + `BrowserActivity` toolbar | C+V ✔ | `npm run test:main`, `npm run check:bridges` | every command routed and asserted; Android controls asserted in source |
| T-9.4 | Tabs | desktop chrome tab strip | C+V ✔ | `npm run test:main` | create/select/close verified; Android = one window per profile (process isolation) — P, documented |
| T-9.5 | Permission management | deny-by-default + per-profile toggles (desktop), deny (Android) | C+V ✔ | `test:main`, `check:bridges` | toggle persists to controls.json; Android refuses + toasts |
| T-9.6 | Private profile controls | clear-data button (both shells) | P | `test:main` | clear-storage verified; per-launch incognito partitions not implemented |
| T-9.7 | Paste as Human (accessibility only) | `packages/fingerprint/src/humanize.ts` | C+V | `npm test` | bounded schedule; no CAPTCHA interaction |

## Accounts and backend (Phases 10–11)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-10.1 | Registration / login / logout | `src/state/supabaseAuth.ts` | C+V (stub) ✔ | `npm test` (auth suite) | was B (facade); real GoTrue calls now, 15 tests incl. confirmation flow |
| T-10.2 | Password reset / change / session refresh | same | C+V (stub) ✔ | `npm test` | refresh-once + refresh-rejection verified |
| T-10.3 | Live end-to-end against the project | — | I | walk T-10.1/2 in the app with real keys | operator step (no live project creds in sandbox) |
| T-10.4 | RLS: users never see others' data | `0001` + `0002` | I ✔ | `tests/backend.test.ts` + live probe | policies pinned by test; live probe pending migration apply |
| T-10.5 | Service-role key absent from frontend | — | C+V | `npm run test:secrets` | 3/3 clean |
| T-10.6 | Admin role enforced on backend | `0002` is_admin/admin_* RPCs | I ✔ | `tests/backend.test.ts` | ADMIN_ONLY guards + owner email pinned; live probe pending |
| T-11.1 | Free = 2 lifetime profiles | `plans.ts`, `0002` trigger | C+V | `npm test` | client + SQL constants match (test asserts both) |
| T-11.2 | Premium features gated | `plans.ts`, store | C+V | `npm test` | browser family locks verified |
| T-11.3 | Limits enforced server-side | `0002` enforce_profile_quota | I ✔ | `tests/backend.test.ts` + live insert probe | trigger + RPC pinned; live probe pending |
| T-11.4 | No invented payments | SettingsView copy | C+V | inspection | "Preview Premium… never charges" — no payment UI exists |

## UI (Phase 12)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-12.1 | Pink, flat, IBM Plex Sans, small radii | `src/theme.ts`, `site/styles.css` | C+V | `npm run test:site` | gradient/dashed/CDN-font gates pass |
| T-12.2 | Responsive 360–1440, no overflow | UI + device matrix | C+V | `npm run test:devices` | 75/75 (prior run; screenshots in repo) |
| T-12.3 | Honest button labels | SettingsView/AuthView | C+V ✔ | inspection | "Preview Premium" + real auth states (was B: fake unlock) |

## Android and performance (Phases 13–14)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-13.1 | Multi-family layouts | `assets/screenshots/devices/` | I | `npm run test:devices` | emulator captures exist; no physical-device claim |
| T-13.2 | Lifecycle: background/resume/kill | `MainActivity`/`BrowserActivity` | I | manual on device | kill-on-exit verified in code (`Process.killProcess`) |
| T-14.1 | Low-spec Windows profiling | — | P | manual profiling on low-spec hardware | mitigations in place (see PROJECT_AUDIT Phase 14); numbers pending hardware |

## Security, CI, docs (Phases 15–22)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-15.1 | Pages cannot reach the IPC bridge | `preload.js` trust gate, no-preload tabs | C+V ✔ | `test:main` (foreign sender rejected), inspection | critical hole closed |
| T-15.2 | Dependency vulnerabilities = 0 | npm overrides | C+V ✔ | `npm audit` | 0 tree-wide (was 11) |
| T-15.3 | Secret scanning in CI | `scripts/check-secrets.mjs` | C+V ✔ | `npm run test:secrets` | gate in CI + release |
| T-16.1 | Unit/integration/UI/E2E suites | `tests/`, `scripts/` | C+V | `TEST_REPORT.md` | 87 + 29 + 15 + 15 + … |
| T-17.1 | CI runs all gates; release builds binaries | workflows | I | PR checks + release run | watched live this session |
| T-18.1 | Windows installer + APK built and published | release workflow | I | release page after tag | workflow verifies asar contents of the real artifact |
| T-19.1 | Docs complete and honest | README + docs/ + this set | C+V | `npm run test:site` | provenance gates pass |
| T-20.1 | Open-source research | `OPEN_SOURCE_RESEARCH.md` | C+V | inspection | licenses + adoption decisions recorded |
