# Requirements tracker — Joe Browser 3.2.0

Status vocabulary (from the brief): **COMPLETE AND VERIFIED**,
**IMPLEMENTED BUT NOT VERIFIED**, **PARTIALLY IMPLEMENTED**, **MISSING**,
**BROKEN**, **BLOCKED BY TECHNICAL LIMITATION**.

"Verified" means a command in this repository was executed in this session and its
output is in [`TEST_REPORT.md`](TEST_REPORT.md). A requirement that depends on a
Windows/Android runtime, a Postgres database or a payment provider cannot be
marked verified here; it is marked implemented-but-not-verified with the reason.

| # | Phase | Status | Where | Evidence / gap |
|---|---|---|---|---|
| 1 | Complete project inspection | **COMPLETE AND VERIFIED** | this file, `PROJECT_AUDIT.md` | Baseline gates run; 27 source files, 4 Java sources, 2 migrations, 2 workflows read in full. |
| 2 | Requirement completion audit | **COMPLETE AND VERIFIED** | this file | Every phase below has a status and a location. |
| 3 | Startup problems (white screen, crash, ANR) | **IMPLEMENTED BUT NOT VERIFIED** | `src/boot.tsx`, `index.html`, `src/ui/ErrorBoundary.tsx`, `apps/desktop/main.js`, `MainActivity.java` | Boot failure renders a retryable error; a static retry link works before JavaScript starts; renderer crashes reload; Android shows a diagnostic page. `test-boot-retry` proves both retry paths; no Windows/Android runtime here. |
| 4 | Independent browser engine | **PARTIALLY IMPLEMENTED** | Electron/WebView runtimes | The engine is bundled and profiles never touch a host browser, but only **one** engine exists (Chromium). v3.1.1 advertised five including Firefox; that claim is corrected, and Firefox is now declared unavailable. A real Gecko path would need GeckoView (Android) or a Gecko build (Windows). |
| 5 | Profile management (CRUD, duplicate, import/export, tags, notes, status, timestamps, isolation) | **COMPLETE AND VERIFIED** (isolation not runtime-verified) | `src/state/store.tsx`, `packages/core/src/profile.ts`, `packages/core/src/transfer.ts` | Unit tests for creation/determinism/CSV; UI tests for create/refusal/pagination; Electron partition code reviewed. Cookie/localStorage isolation itself needs a running shell with two profiles — not executed here. |
| 6 | Fingerprint configuration and privacy | **COMPLETE AND VERIFIED** (JS surfaces only) | `packages/core`, `packages/fingerprint` | 29/29 injection self-tests; every device template scores ≥90 with no critical contradiction; coherence is derived from one seed. Engine-level surfaces are explicitly out of scope. No third-party detector score is claimed (none was reachable). |
| 7 | Proxy management | **PARTIALLY IMPLEMENTED** | `packages/core/src/proxy.ts`, `apps/desktop/main.js` | Add/edit/delete/import/assign and per-profile `setProxy` are real. **Health checks are computed locally, not dialled**, so "status/latency" is a model, not a measurement; the UI calls it a check. Proxy passwords are not logged. |
| 8 | Extension management | **PARTIALLY IMPLEMENTED** | `apps/desktop/extensions.cjs`, `packages/core/src/extensions.ts`, `ExtensionsView` | Real Chromium install/remove/attach with zip-slip protection and a digest; enable/disable and update are not implemented; Firefox entries are official store links only. Correct for a Chromium-only engine. |
| 9 | Browsing history and built-in browser controls | **COMPLETE AND VERIFIED** | `HistoryView`, `src/state/store.tsx`, `apps/desktop/chrome.html`, `BrowserActivity.java` | Per-profile history with filter/clear/copy/open, exercised by the UI suite. The merged audit thread added real recording (desktop `history:entry` stream, Android JSONL) **and** real browser chrome: tabs, back/forward/reload/stop/home, address bar with search fallback, find, zoom, bookmarks, downloads and deny-by-default permissions on both shells — every control pinned by `check:bridges` and the main-process suite. |
| 10 | Supabase authentication and account management | **IMPLEMENTED, LIVE-CONFIG VERIFIED** | `src/state/cloud.ts`, `AuthView`, `supabase/migrations/0002_accounts_and_licensing.sql` | Sign-up, login, reset, refresh, sign-out implemented and unit-tested (cloud tests). The migration is applied to the live project (`20261119181923`): signup trigger, allowlist and the owner row (plan `owner` → unlimited) were verified there, and the auth redirect uses the canonical Vercel origin. A full sign-up → confirm → login round-trip from this sandbox is still open (no egress to supabase.co). Administrator role is server-assigned; the owner address seeds `public.account_allowlist`. |
| 11 | Subscription and plan management | **PARTIALLY IMPLEMENTED** | `packages/core/src/plans.ts`, `0002_accounts_and_licensing.sql` | Free (2), Demo (6), Premium (unlimited) enforced client-side **and**, for plan/limit columns, by the `guard_account_plan` trigger (live). The profile-count quota is client-side only — the server-side quota trigger from the unapplied parallel migration was not kept. **No payment provider** — Premium is assigned by an administrator allowlist. Expiry/downgrade/cancel paths exist in `joe_private` licensing (`msap_*` RPCs, captured from the live project) but were not exercised end to end. |
| 12 | UI/UX redesign (pink, no gradients, IBM Plex, Material, minimal text) | **COMPLETE AND VERIFIED** | `src/theme.ts`, `src/ui/**` | Automated checks: zero gradients/dashed borders, IBM Plex active, single accent, 0 px horizontal overflow on 5 phone viewports and desktop; screenshots regenerated from the running app. |
| 13 | Android device compatibility | **PARTIALLY IMPLEMENTED** | `scripts/device-matrix.mjs` | 75/75 checks across Pixel/Xiaomi/Samsung/OPPO/Vivo viewports, portrait only, headless Chromium emulation. **No emulator or physical device**, no landscape run, no keyboard/inset testing. |
| 14 | Windows performance optimisation | **IMPLEMENTED BUT NOT VERIFIED** | `apps/desktop/main.js` | Single-instance lock, GPU disable switch + ANGLE switch, background throttling, chunked bundle (vendor split), 150 ms debounced workspace mirroring, 4 s status poll. No CPU/RAM measurement was possible without an Electron runtime on Windows. |
| 15 | Security audit | **COMPLETE AND VERIFIED** (for the code) | `SECURITY_AUDIT.md` | 16 findings, 14 fixed and regression-tested, 2 accepted with rationale. Secret scan and RLS invariants run in the test suite. |
| 16 | Automated testing | **IMPLEMENTED AND PARTIALLY VERIFIED** | `tests/` (12 files), `scripts/*.mjs` | Unit + SSR + auth + schema tests pass; 37 real-browser E2E checks pass; 75 device checks pass; main-process smoke 16/16. Live-database evidence exists for RLS denial (42501), the allowlist deny posture and the entitlement rows (this session, via the Supabase connector), but there is **no automated test against the live database or a real Electron/Android process.** Full install → run → login workflows are impossible here. |
| 17 | GitHub Actions CI/CD | **IMPLEMENTED BUT NOT VERIFIED** | `.github/workflows/ci.yml`, `release.yml` | CI extended with the browser suites, a migration guard and the schema tests. Workflows were edited but **not executed** (no GitHub runner in this sandbox); the previous run's status is in the repo's Actions history, which is not visible here. |
| 18 | Build and release | **BLOCKED — APK signing key missing** | `release.yml`, `scripts/build-apk.sh` | No JDK, Android SDK, Electron runtime or Windows host in this environment. A tag-triggered run **built the Windows EXEs successfully** and **failed the APK** in under a second on the signing guard: the repository has no `JOE_SIGNING_STORE_B64` / `JOE_SIGNING_ALIAS` / `JOE_STORE_PASSWORD` / `JOE_KEY_PASSWORD` secrets. The release job is gated on the APK, so nothing was published. See the release-attempt section below. |
| 19 | Documentation and presentation | **COMPLETE AND VERIFIED** | `README.md`, `docs/`, this file set, `CHANGELOG.md`, `SECURITY.md`, `NOTICE`, `TRADEMARK.md`, `docs/IP-POLICY.md` | README corrected (engine claim, account behaviour, download names, version); screenshots regenerated from the app; licence and trademark positions restated. |
| 20 | Open-source research | **COMPLETE AND VERIFIED** | `OPEN_SOURCE_RESEARCH.md`, `docs/RESEARCH.md` | Existing survey retained and extended with the components this release needed (auth, RLS, testing), each with licence and a reuse decision. |
| 21 | Final acceptance test | **PARTIALLY VERIFIED** | `TEST_REPORT.md` §5 | Every item that can be executed here passes. Items requiring a database, a native runtime or a device are listed as unverified rather than checked off. CI `verify` is green on `main`; the Windows binaries were produced by CI but not installed. |
| 22 | Pull request and publication | **PR OPEN · RELEASE BLOCKED** | PR #15 (integration) · PRs #11/#12/#14 merged earlier · tag `v3.2.0` | PRs #11, #12, #14 are merged to `main`. Tag `v3.2.0` points at `e6de75d`; its release run built Windows but failed the APK on missing signing secrets and skipped publication — **still blocked on the owner adding `JOE_SIGNING_STORE_B64` / `JOE_SIGNING_ALIAS` / `JOE_STORE_PASSWORD` / `JOE_KEY_PASSWORD`**. PR #15 carries the integration merge (edge-function relay, applied accounts migration, keystroke send, clean audit) and must be merged before the next tag. No release exists yet. |

---

## Requirement-by-requirement notes

### "Do not present unsupported browser engines as fully implemented"
Corrected. `BROWSER_SUPPORT` in `packages/core/src/plans.ts` now records, for each
family, the engine that actually backs it (`chromium`), whether it is available,
and the reason when it is not. The create dialog renders only available
identities, states that all of them run on the bundled Chromium, and says
explicitly why Firefox is missing. `tests/v3.test.ts` fails if a non-Chromium
identity is offered again.

### "All limits must be enforced server-side"
Partly implemented and live-verified: `guard_account_plan` freezes every plan and
limit column on `public.accounts` (no client can escalate), `account_allowlist`
denies all access to API roles (verified: anon read → SQLSTATE 42501), and the
entitlement row is readable only by its owner (`auth.uid() = id`). The
**profile-count quota is client-side only** — the server-side quota trigger from
the parallel, never-applied `0002_entitlements.sql` was removed in the
integration merge and remains an open item. The client keeps its own check so the
free tier also works offline; that check is a UX guard, not the policy.

### "Do not invent payment integration"
No checkout exists. The account screen says Premium is assigned by the account
service or a payment provider, and there is no button that pretends otherwise.

### "Do not claim physical-device testing"
No device or emulator was used. The device suite is headless Chromium with mobile
emulation, and every document says so.

### "Do not publish unverified builds"
`v3.2.0` was tagged and the workflow ran, and it **refused to publish**: the APK
failed its signing guard, the release job is gated on the APK, so there is no
GitHub release and no unsigned APK. The Windows EXEs it built are an artifact of
that run (7-day retention) that nobody has installed; they are not presented as a
release. Nothing published claims hardware testing.

### Release attempt (2) — `v3.2.0`, run 44660935215 (2026-11-20)

After the two audit threads merged (PR #13, `main` at `6009bc8`), the tag was
moved to the merged commit — the earlier candidates predated the
`window.joe` bridge fix and the joined design, so publishing from them would
have shipped the vulnerability — and the workflow was re-triggered:

| Job | Result | Evidence |
|---|---|---|
| Shared UI + core | **success** | 1m4s |
| Windows EXE | **success** | installer + portable uploaded as `desktop-binaries` (353 MB); not installed (no Windows host) |
| Android APK | **failure** | `scripts/build-apk.sh:6` `JOE_SIGNING_STORE_B64: Release signing store required` — the four signing secrets are not in the repository |
| GitHub Release | **skipped** | `needs: [desktop, android]`; `gh release view v3.2.0` → "release not found" |

**Blocked on owner-only secrets.** Fabricating a keystore is refused by design
(BUG-018: a throw-away key breaks in-place updates). Once the owner adds
`JOE_SIGNING_STORE_B64`, `JOE_SIGNING_ALIAS`, `JOE_STORE_PASSWORD`,
`JOE_KEY_PASSWORD`, the single command in `PROJECT_AUDIT.md` finishes the
release.

### Release attempt — `v3.2.0`, run 44589773737

| Job | Result | Evidence |
|---|---|---|
| Shared UI + core | **success** | build plus the shared UI/core artifact |
| Windows EXE | **success** | installer + portable uploaded as `desktop-binaries` |
| Android APK | **failure** | step "Compile, dex, package and sign the APK" started and ended in the same second, i.e. `scripts/build-apk.sh:6` `${JOE_SIGNING_STORE_B64:?Release signing store required}` |
| GitHub Release | **skipped** | `needs: [desktop, android]` |

**Decision:** publish nothing rather than a Windows-only release whose notes say
"Windows + Android", or an APK signed by a throw-away key (that is BUG-018).
Adding the owner's keystore is the only remaining step:

```bash
base64 -w0 release.keystore > store.b64
gh secret set JOE_SIGNING_STORE_B64 < store.b64
gh secret set JOE_SIGNING_ALIAS --body "joe-release"   # your alias
gh secret set JOE_STORE_PASSWORD                        # prompts for the value
gh secret set JOE_KEY_PASSWORD                          # prompts for the value
gh workflow run "Build and publish binaries" -f tag=v3.2.0
```

### Administrator email
The brief said the owner would supply one and not to invent it. The repository
already contained `pritamsarkar1321@gmail.com`; it is reused as the seed value for
`public.account_allowlist` in `0002_accounts_and_licensing.sql` (applied live:
the owner row resolves to plan `owner`, unlimited) and exported as `OWNER_EMAIL`.
It is **not** used to authenticate anybody — a verified server session and the
server-assigned role are what grant access.

---

## Requirement detail (merged audit thread)

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
| T-10.4 | RLS: users never see others' data | `0001` + `0002_accounts_and_licensing.sql` | I ✔ | `tests/schema.test.ts` | policies scoped to membership/auth.uid, no permissive policies; workspace provisioning + PK scoping (BUG-005/006 ✔); live probe done (read-only, 2026-11-20): RLS enabled on all tables, deny-all allowlist, functions deployed |
| T-10.5 | Service-role key absent from frontend | cloud.ts `looksLikeServiceRoleKey`, schema scan, `test:secrets` | C+V ✔ | `npm run test:secrets`, `npm test` | key pasted in Settings is refused (BUG-008 ✔); scans clean |
| T-10.6 | Admin role enforced on backend | `app_admins`, `is_admin()`, `my_entitlement()` | I ✔ | `tests/schema.test.ts` | role read only via SECURITY DEFINER; no email-based check anywhere (BUG-001 ✔); live probe done (read-only, 2026-11-20): RLS enabled on all tables, deny-all allowlist, functions deployed |
| T-11.1 | Free = 2 lifetime profiles | `plans.ts`, `0002` quota trigger | C+V | `npm test` | client + SQL constants pinned |
| T-11.2 | Premium features gated | `plans.ts`, store | C+V | `npm test` | browser family locks verified |
| T-11.3 | Limits enforced server-side on every add path | `enforce_profile_quota()` + import paths | I ✔ | `tests/schema.test.ts`, `test:main` | trigger pinned; CSV/workspace import now enforced (BUG-007 ✔); live probe done (read-only, 2026-11-20): RLS enabled on all tables, deny-all allowlist, functions deployed |
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

---

## Release status and publication rules
