# REQUIREMENTS_TRACKER — Joe Browser 3.2.0

Requirement-by-requirement status against the product spec. Statuses:
**COMPLETE AND VERIFIED** (C+V), **IMPLEMENTED BUT NOT VERIFIED** (I),
**PARTIALLY IMPLEMENTED** (P), **MISSING** (M), **BROKEN** (B — all found B
items are fixed ✔), **BLOCKED BY TECHNICAL LIMITATION** (BL).

Verification column records what the named command produced on 2026-11-19.

## Startup and stability (Phase 3)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-3.1 | No permanent blank screen; recovery even when the entry script fails | `src/boot.tsx`, `scripts/test-boot-retry.mjs` | C+V | `npm run test:boot` | both retry paths pass headless; failure screen has Retry |
| T-3.2 | Packaged app boots (no missing modules) | `scripts/check-packaged.mjs`, `scripts/check-desktop.mjs` | C+V | `npm run test:packaged`, `npm run test:desktop` | 4/4 + 11/11; removing a runtime entry from `build.files` fails the gate (reproduced for extensions.cjs in 3.1.1) |
| T-3.3 | Second launch focuses, single instance | `apps/desktop/main.js` | C+V | `npm run test:main` | single-instance lock verified at boot |
| T-3.4 | GPU fallback switch | `JOE_DISABLE_GPU`, `--disable-gpu` | I | manual on Windows | code inspected |
| T-3.5 | Version surfaces agree | `tests/version.test.ts` | C+V ✔ | `npm test` | shell/Android/site/manifest all derive from package.json (was B: shell said 3.1.0 — BUG-012) |

## Engine and profiles (Phases 4–5)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-4.1 | No dependency on host Chrome/Firefox/Edge | `apps/desktop/main.js`, `extensions.cjs` | C+V | inspection + `test:main` | engine = Electron Chromium / Android WebView; no host profile paths read |
| T-4.2 | Engines presented honestly | browser picker, README | C+V ✔ | `npm run test:site` | one bundled Chromium engine, four identities; Firefox removed from the picker rather than faked |
| T-5.1 | Profile CRUD + duplicate/rename/tags/notes | `src/state/store.tsx`, `test:main` | C+V | `npm run test:main` | create/update/delete round-trip, bulk create verified |
| T-5.2 | Import/export JSON + CSV | `packages/core/src/transfer.ts` | C+V | `npm run test:main` | round-trips verified; **quota now enforced on import** (BUG-007 ✔) |
| T-5.3 | Storage isolation per profile | session partitions (desktop), data-dir suffix (Android) | I | engine primitive; manual cross-profile cookie check on device | partition/suffix asserted at launch (`persist:<id>`); primary keys scoped per workspace (BUG-006 ✔) |
| T-5.4 | Search/filter/group/status/timestamps | `ProfilesView.tsx` | C+V | `npm run test:ui` | covered |

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
| T-7.2 | Test connection, offline/recovery/rotation alerts | `store.tsx` proxy monitor | C+V | `tests/v2.test.ts` | transition-based notifications verified |
| T-7.3 | Proxy per profile, no password in logs/UI | `main.js` `proxyFor` | C+V | inspection | credentials only in workspace/session config; UI shows host:port |

## Extensions (Phase 8)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-8.1 | Catalog, search, details, store links | `packages/core/src/extensions.ts`, `ExtensionsView.tsx` | C+V | `npm test`, `test:ui` | 12 real entries, family store links |
| T-8.2 | Install/remove/enable (desktop, unpacked) | `extensions.cjs` | C+V | `npm run test:main` | zip-slip refusal, digest, manifest validation verified |
| T-8.3 | No silent installs; signed-CRX limits stated | `ExtensionsView.tsx`, module docs | C+V | inspection | store-link fallback explicit |

## History and browser controls (Phase 9)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-9.1 | History records every visit per profile | `main.js` attachHistory, `BrowserActivity.recordHistory`, `core/history.ts` | C+V ✔ | `npm test` + `npm run test:main` | was B (BUG-019: no recorder existed); now entries stream with title refresh, search flag, dedupe; native clear on delete |
| T-9.2 | History list: title/URL/date/time, copy, open, delete, clear, search, filter | `HistoryView.tsx` | C+V | `npm run test:ui` | covered |
| T-9.3 | Controls: back/forward/reload/home/address/find/zoom/bookmarks/downloads | `chrome.html` + `BrowserActivity` toolbar | C+V ✔ | `npm run test:main`, `npm run check:bridges` | every command routed and asserted; Android controls pinned in source |
| T-9.4 | Tabs | desktop chrome tab strip | C+V ✔ | `npm run test:main` | create/select/close verified; Android = one window per profile (process isolation) — P, documented |
| T-9.5 | Permission management | deny-by-default + per-profile toggles (desktop), deny (Android) | C+V ✔ | `test:main`, `check:bridges` | toggle persists; Android refuses + toasts |
| T-9.6 | Private profile controls | clear-data button (both shells) | P | `test:main` | clear-storage verified; per-launch incognito partitions not implemented |
| T-9.7 | Paste as Human (accessibility only) | `packages/fingerprint/src/humanize.ts` | C+V | `npm test` | bounded schedule; no CAPTCHA interaction |

## Accounts and backend (Phases 10–11)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-10.1 | Registration / login / logout | `src/state/cloud.ts` | C+V (stub) ✔ | `npm test` (cloud suite, 21) | was B (BUG-002 facade); real GoTrue flows with specific failure mapping |
| T-10.2 | Password reset / change / session refresh | `src/state/cloud.ts` | C+V (stub) ✔ | `npm test` | refresh-token rotation, offline grace, revoked-token path verified |
| T-10.3 | Live end-to-end against the project | — | I | walk T-10.1/2 in the app with real keys | operator step |
| T-10.4 | RLS: users never see others' data | `0001` + `0002_entitlements.sql` | I ✔ | `tests/schema.test.ts` | policies scoped to membership/auth.uid, no permissive policies; workspace provisioning + PK scoping (BUG-005/006 ✔); live probe pending |
| T-10.5 | Service-role key absent from frontend | cloud.ts `looksLikeServiceRoleKey`, schema scan, `test:secrets` | C+V ✔ | `npm run test:secrets`, `npm test` | key pasted in Settings is refused (BUG-008 ✔); scans clean |
| T-10.6 | Admin role enforced on backend | `app_admins`, `is_admin()`, `my_entitlement()` | I ✔ | `tests/schema.test.ts` | role read only via SECURITY DEFINER; no email-based check anywhere (BUG-001 ✔); live probe pending |
| T-11.1 | Free = 2 lifetime profiles | `plans.ts`, `0002` quota trigger | C+V | `npm test` | client + SQL constants pinned |
| T-11.2 | Premium features gated | `plans.ts`, store | C+V | `npm test` | browser family locks verified |
| T-11.3 | Limits enforced server-side on every add path | `enforce_profile_quota()` + import paths | I ✔ | `tests/schema.test.ts`, `test:main` | trigger pinned; CSV/workspace import now enforced (BUG-007 ✔); live probe pending |
| T-11.4 | No invented payments | Settings copy, no payment UI | C+V ✔ | inspection | "Unlock Premium" removed (BUG-003 ✔); Premium granted via service role only |

## UI (Phase 12)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-12.1 | Pink, flat, IBM Plex Sans, small radii | `src/theme.ts`, `site/styles.css` | C+V | `npm run test:site` | gradient/dashed/CDN-font gates pass |
| T-12.2 | Responsive 360–1440, no overflow | UI + device matrix | C+V | `npm run test:devices` | 75/75 emulator checks |
| T-12.3 | Honest account surfaces | AuthView/SettingsView | C+V ✔ | `npm test`, inspection | server-error states, plan provenance line, no fake unlock |

## Android and performance (Phases 13–14)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-13.1 | Multi-family layouts | `assets/screenshots/devices/` | I | `npm run test:devices` | emulator captures; no physical-device claim |
| T-13.2 | Lifecycle: background/resume/kill | `MainActivity`/`BrowserActivity` | I | manual on device | kill-on-exit verified in code |
| T-13.3 | Android sync authenticates to RLS | `SyncHttp` session token | C+V ✔ | `npm run check:bridges` | was B (BUG-004: anon-key writes all refused); session JWT + server-resolved workspace now asserted |
| T-14.1 | Low-spec Windows profiling | — | P | manual profiling on low-spec hardware | mitigations in place; numbers pending hardware |

## Security, CI, docs (Phases 15–22)

| # | Requirement | Location | Status | Test procedure | Verification |
|---|---|---|---|---|---|
| T-15.1 | Pages cannot reach the IPC bridge | `preload.js` trust gate, no-preload tabs | C+V ✔ | `test:main` (foreign sender rejected), inspection | critical hole closed (BUG-020) |
| T-15.2 | Dependency vulnerabilities = 0 | npm overrides + upgrades | C+V ✔ | `npm audit` | 0 tree-wide (was 11 — BUG-021) |
| T-15.3 | Secret scanning in CI | `scripts/check-secrets.mjs` + schema scan | C+V ✔ | `npm run test:secrets` | gates in CI + release |
| T-16.1 | Unit/integration/UI/E2E suites | `tests/`, `scripts/` | C+V | `TEST_REPORT.md` | matrix + revert-the-fix failure proofs |
| T-17.1 | CI runs all gates; release builds binaries | workflows | I | PR checks + release run | watched live this session |
| T-18.1 | Windows installer + APK built and published | release workflow | I | release page after tag | persistent APK signing required (BUG-018 ✔); asar contents verified in CI |
| T-19.1 | Docs complete and honest | README + docs/ + this set | C+V | `npm run test:site` | provenance gates pass |
| T-20.1 | Open-source research | `OPEN_SOURCE_RESEARCH.md` | C+V | inspection | licenses + adoption decisions recorded |

## Administrator email

The owner-supplied address `pritamsarkar1321@gmail.com` is a **database
bootstrap value** only (`OWNER_EMAIL` in `packages/core/src/plans.ts`, seeded
into `app_admins` by the migration). It authorises nothing in the client; admin
rights require a server-verified session and a server-assigned role.
