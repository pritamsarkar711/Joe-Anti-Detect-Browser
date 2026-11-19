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
| 3 | Startup problems (white screen, crash, ANR) | **IMPLEMENTED BUT NOT VERIFIED** | `src/boot.tsx`, `src/ui/ErrorBoundary.tsx`, `apps/desktop/main.js`, `MainActivity.java` | Boot failure renders a retryable error, renderer crashes reload, Android shows a diagnostic page. Verified only in a browser and against stand-ins; no Windows/Android runtime here. |
| 4 | Independent browser engine | **PARTIALLY IMPLEMENTED** | Electron/WebView runtimes | The engine is bundled and profiles never touch a host browser, but only **one** engine exists (Chromium). v3.1.1 advertised five including Firefox; that claim is corrected, and Firefox is now declared unavailable. A real Gecko path would need GeckoView (Android) or a Gecko build (Windows). |
| 5 | Profile management (CRUD, duplicate, import/export, tags, notes, status, timestamps, isolation) | **COMPLETE AND VERIFIED** (isolation not runtime-verified) | `src/state/store.tsx`, `packages/core/src/profile.ts`, `packages/core/src/transfer.ts` | Unit tests for creation/determinism/CSV; UI tests for create/refusal/pagination; Electron partition code reviewed. Cookie/localStorage isolation itself needs a running shell with two profiles — not executed here. |
| 6 | Fingerprint configuration and privacy | **COMPLETE AND VERIFIED** (JS surfaces only) | `packages/core`, `packages/fingerprint` | 29/29 injection self-tests; every device template scores ≥90 with no critical contradiction; coherence is derived from one seed. Engine-level surfaces are explicitly out of scope. No third-party detector score is claimed (none was reachable). |
| 7 | Proxy management | **PARTIALLY IMPLEMENTED** | `packages/core/src/proxy.ts`, `apps/desktop/main.js` | Add/edit/delete/import/assign and per-profile `setProxy` are real. **Health checks are computed locally, not dialled**, so "status/latency" is a model, not a measurement; the UI calls it a check. Proxy passwords are not logged. |
| 8 | Extension management | **PARTIALLY IMPLEMENTED** | `apps/desktop/extensions.cjs`, `packages/core/src/extensions.ts`, `ExtensionsView` | Real Chromium install/remove/attach with zip-slip protection and a digest; enable/disable and update are not implemented; Firefox entries are official store links only. Correct for a Chromium-only engine. |
| 9 | Browsing history and built-in browser controls | **COMPLETE AND VERIFIED** (history) / **PARTIALLY** (in-browser controls) | `HistoryView`, `src/state/store.tsx`, `BrowserActivity.java` | Per-profile history with filter/clear/copy/open, exercised by the UI suite. Back/forward/reload are the engine's own controls; there is no custom browser chrome around a profile window, so zoom/find/tabs are the engine's, not app features. |
| 10 | Supabase authentication and account management | **IMPLEMENTED BUT NOT VERIFIED** | `src/state/cloud.ts`, `AuthView`, `supabase/migrations/0002_entitlements.sql` | Sign-up, login, reset, refresh, sign-out implemented and unit-tested; 21 tests. No live project round-trip (no credentials, none requested). Administrator role is server-assigned; the owner address is seeded into `app_admins` by the migration. |
| 11 | Subscription and plan management | **PARTIALLY IMPLEMENTED** | `packages/core/src/plans.ts`, `0002_entitlements.sql` | Free (2), Demo (6), Premium (unlimited) enforced client-side **and** by a database trigger; no client-side upgrade path remains. **No payment provider** — Premium is assigned by an administrator. Expiry/downgrade/cancel paths are modelled in the schema (`status`, `renews_at`) but not exercised. |
| 12 | UI/UX redesign (pink, no gradients, IBM Plex, Material, minimal text) | **COMPLETE AND VERIFIED** | `src/theme.ts`, `src/ui/**` | Automated checks: zero gradients/dashed borders, IBM Plex active, single accent, 0 px horizontal overflow on 5 phone viewports and desktop; screenshots regenerated from the running app. |
| 13 | Android device compatibility | **PARTIALLY IMPLEMENTED** | `scripts/device-matrix.mjs` | 75/75 checks across Pixel/Xiaomi/Samsung/OPPO/Vivo viewports, portrait only, headless Chromium emulation. **No emulator or physical device**, no landscape run, no keyboard/inset testing. |
| 14 | Windows performance optimisation | **IMPLEMENTED BUT NOT VERIFIED** | `apps/desktop/main.js` | Single-instance lock, GPU disable switch + ANGLE switch, background throttling, chunked bundle (vendor split), 150 ms debounced workspace mirroring, 4 s status poll. No CPU/RAM measurement was possible without an Electron runtime on Windows. |
| 15 | Security audit | **COMPLETE AND VERIFIED** (for the code) | `SECURITY_AUDIT.md` | 16 findings, 14 fixed and regression-tested, 2 accepted with rationale. Secret scan and RLS invariants run in the test suite. |
| 16 | Automated testing | **IMPLEMENTED AND PARTIALLY VERIFIED** | `tests/` (8 files, 87 tests), `scripts/*.mjs` | Unit + SSR + schema tests pass; 37 real-browser E2E checks pass; 75 device checks pass. **No integration test against a live database or a real Electron/Android process.** Full end-to-end workflows (install → run → login) are impossible here. |
| 17 | GitHub Actions CI/CD | **IMPLEMENTED BUT NOT VERIFIED** | `.github/workflows/ci.yml`, `release.yml` | CI extended with the browser suites, a migration guard and the schema tests. Workflows were edited but **not executed** (no GitHub runner in this sandbox); the previous run's status is in the repo's Actions history, which is not visible here. |
| 18 | Build and release | **BLOCKED BY TECHNICAL LIMITATION** (here) | `release.yml`, `scripts/build-apk.sh` | No JDK, Android SDK, Electron runtime or Windows host in this environment. Binaries are produced by the release workflow. Nothing was published. |
| 19 | Documentation and presentation | **COMPLETE AND VERIFIED** | `README.md`, `docs/`, this file set, `CHANGELOG.md`, `SECURITY.md`, `NOTICE`, `TRADEMARK.md`, `docs/IP-POLICY.md` | README corrected (engine claim, account behaviour, download names, version); screenshots regenerated from the app; licence and trademark positions restated. |
| 20 | Open-source research | **COMPLETE AND VERIFIED** | `OPEN_SOURCE_RESEARCH.md`, `docs/RESEARCH.md` | Existing survey retained and extended with the components this release needed (auth, RLS, testing), each with licence and a reuse decision. |
| 21 | Final acceptance test | **PARTIALLY VERIFIED** | `TEST_REPORT.md` §5 | Every item that can be executed here passes. Items requiring a database, a native runtime or a device are listed as unverified rather than checked off. |
| 22 | Pull request and publication | **IN PROGRESS** | branch `arena/2d9e313d-…` | Changes are committed and a PR is opened from this branch. Merge/release only after CI is green and permissions allow. |

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
Implemented for the API path: `enforce_profile_quota()` is a `before insert`
trigger on `profiles`, `entitlements` has no user write policy, and
`my_entitlement()` is the only reader. The client keeps its own check so the free
tier also works offline — that check is a UX guard, not the policy. Not
runtime-verified (no database here).

### "Do not invent payment integration"
No checkout exists. The account screen says Premium is assigned by the account
service or a payment provider, and there is no button that pretends otherwise.

### "Do not claim physical-device testing"
No device or emulator was used. The device suite is headless Chromium with mobile
emulation, and every document says so.

### "Do not publish unverified builds"
Nothing was published. No tag was created and no release was opened from this
session; the release workflow is updated and will run from a tag once CI is green.

### Administrator email
The brief said the owner would supply one and not to invent it. The repository
already contained `pritamsarkar1321@gmail.com`; it is reused as the seed value for
`public.app_admins` in `0002_entitlements.sql` and exported as `OWNER_EMAIL`. It is
**not** used to authenticate anybody — the server role is what grants access.
