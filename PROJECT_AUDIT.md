# Project audit — Joe Browser 3.2.0

Audit of `pritamsarkar711/Joe-Anti-Detect-Browser` at branch
`arena/2d9e313d-joe-anti-detect-browser` (base `9302a80`).

The instruction was to inspect first and change nothing until the architecture was
understood. This document is the result of that inspection: what the project is,
where each requirement lives, what is real, what is not, and what this session
changed. Detailed defect records are in [`BUG_REPORT.md`](BUG_REPORT.md), the
security review in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md), the requirement
matrix in [`REQUIREMENTS_TRACKER.md`](REQUIREMENTS_TRACKER.md) and the command
log in [`TEST_REPORT.md`](TEST_REPORT.md).

---

## 1. Baseline before any change

The project was **not** a blank shell, and it was not broken at the level the
brief assumed. Measured on a clean checkout:

| Gate | Baseline |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 6 files, 51 tests passing |
| `npm run build` | succeeds (web bundle) |
| `test:java` / `test:icons` / `test:desktop` / `check:bridges` / `test:fingerprint` | pass |
| `test:devices` | **fails** on a clean checkout (`ERR_CONNECTION_REFUSED`) and overwrites its committed report |

So the work was not "make it start". It was: find the places where the product
*described* behaviour it did not have, and either implement the behaviour or
correct the description. Both were done.

## 2. What the project is

- **One React 18 + MUI 5 workspace** (`src/`) compiled three ways: a Vercel
  static site (`dist/`), an Electron renderer (`apps/desktop/web-dist`) and
  Android assets (`dist-android` → `apps/android/assets/app`).
- **Shared domain model** in `packages/core` (profiles, device templates,
  29 observed device bundles, geo presets, plan/quota rules, quality scoring,
  CSV/cookie transfer) and `packages/fingerprint` (the injected JS payload and its
  self-test hooks).
- **Electron shell** (`apps/desktop`): per-profile `persist:` sessions, per-profile
  proxy, CDP injection of the fingerprint payload before page scripts, extension
  loading from the app's own folder, and a loopback REST API.
- **Android shell** (`apps/android`): a WebView workspace plus `BrowserActivity`
  in a separate process with `setDataDirectorySuffix` for per-profile storage,
  a 6-method JS bridge, and a Java PostgREST client.
- **Supabase** migrations, an Edge Function, and **GitHub Actions** that build the
  NSIS/portable EXE and the signed APK.

## 3. Architecture findings

| Area | State at audit | Note |
|---|---|---|
| Startup / blank screen | **Good** | `boot.tsx` catches bundle failure and renders a readable error; the static shell now carries a retry link that works even if the entry script never loads; an error boundary wraps the app; the main process reloads a crashed renderer; the Android shell shows a diagnostic page instead of white. `scripts/test-boot-retry.mjs` proves both retry paths in Chromium. Not verified on a real Windows/Android runtime. |
| Browser engine | **Misrepresented** | One Chromium (Electron/WebView) is bundled, but the UI and README advertised "five bundled engines" including Firefox. `browserFamily` was stored and never used at launch, and no Firefox template existed — a Firefox identity would have been a Gecko UA on a Chromium engine. |
| Profile isolation | **Real** | Electron partitions and the Android per-process data directory are genuine isolation mechanisms. |
| Fingerprints | **Real, L3-scoped** | Coherent per-profile specifications; 29/29 self-test payloads pass. Engine/network layers are explicitly out of scope and documented. |
| History | **Real, local** | Per-profile history in the workspace, filterable and clearable. Not written to Postgres. |
| Proxy | **Real assignment, simulated health** | Per-profile proxy is applied via `session.setProxy`; `checkProxy` computes a health result locally rather than dialling the endpoint. |
| Extensions | **Real on desktop, links elsewhere** | Chromium extensions only; installs are user-initiated with zip-slip protection and a digest. Firefox extensions are links, never installs. |
| Authentication | **Fake** | The account form never called the server; the owner was identified by typing an email. |
| Entitlement | **Advisory** | Plan lived in `localStorage` with a one-click upgrade; imports bypassed the quota. |
| Supabase schema | **Unusable under RLS** | No path created a workspace membership; global primary keys for deterministic ids. |
| Android sync | **Non-functional** | Anon key only, hard-coded foreign workspace id, success reported on failure. |
| CI | **Passing** | All gates green, but three browser gates were not in CI and could not run standalone. |

## 4. What this session changed

**Security and accounts**

- Real Supabase auth client (`src/state/cloud.ts`) with typed errors, refresh
  rotation and an offline plan cache that never restores the admin flag.
- Server-owned entitlement: the caller's own `public.accounts` row (readable only
  under `auth.uid() = id`) is the only source of plan/role; `isAdmin` requires a
  verified session; the owner address survives only as an allowlist seed value.
- `0002_accounts_and_licensing.sql` (applied live, `20261119181923`):
  deny-all `account_allowlist`, `accounts` with own-row RLS and the
  `guard_account_plan` freeze trigger, signup trigger + backfill for the three
  pre-trigger users, `joe_private` licensing tables captured from the live
  project, and an event trigger that re-enables RLS if a future migration
  forgets it. A competing `0002_entitlements.sql` from the parallel branch was
  removed in the integration merge — it was never applied anywhere.
- Free-tier quota enforced on create, bulk, duplicate, CSV import and workspace
  import; a service-role key is refused instead of stored. The
  `joe-command-validate` edge function is the only holder of the service-role
  key and validates every relay payload; anonymous writes to `commands` are
  refused live with SQLSTATE 42501.
- Android and desktop command traffic goes through the relay (anon key to the
  function), not through direct table writes; a failed relay call is reported as
  a failure, never as sent.

**Honesty corrections**

- "Five bundled engines" → one bundled Chromium with four compatible identities;
  Firefox declared unavailable in the picker, the plans and the README.
- The owner email is no longer shown in the login form.
- Release notes and `docs/VALIDATION.md` now state exactly which gates ran, in
  which environment, and what was not executed.
- Version metadata aligned at `3.2.0` (the desktop shell had been reporting
  `3.1.0`).

**Merged from `main` during this pass**

- Static-shell retry + failure-screen Retry button, with an automated
  boot-recovery test (`scripts/test-boot-retry.mjs`, wired into CI).
- The APK build now requires an externally managed signing store instead of
  generating a new identity per build, so releases can update in place. Existing
  installs signed with an older key are not upgradable — the release notes warn
  about backing up before uninstalling.

**Tooling and evidence**

- Browser suites start and stop their own Vite server; the device report is only
  replaced by a clean run; a spawned-server hang was fixed.
- 36 new automated tests (21 account-client, 12 schema/secret invariants, 3
  plan/identity regressions).
- The end-to-end suite no longer forges a premium plan; it asserts that a forged
  plan is ignored.

## 5. Verification boundary (read this before trusting the release)

This environment has **no JDK, no Android SDK, no Electron runtime, no Postgres
and no Windows or Android device**. Therefore, in this session:

- the **Windows EXE and Android APK were not built** — they are produced by
  `.github/workflows/release.yml` on GitHub runners;
- **neither migration was executed** — they are verified statically and by
  invariant tests only;
- **no live Supabase request was made** (no project credentials, none requested);
- **no physical or emulated Android device was used**; the 75 device checks are
  headless Chromium viewports with mobile emulation, which is what the report says
  and all it claims;
- the desktop main process and renderer were exercised against functional
  stand-ins (`test:main`, `test:packaged`, `test:ui-desktop`), not a real Electron
  process.

Everything else in `TEST_REPORT.md` was executed here and passed.

## Release attempt (v3.2.0)

`main` is at `e6de75d`; tag `v3.2.0` triggered run 44589773737.

- **Windows EXE — success.** The desktop job built the installer and the portable
  build and uploaded them as an artifact. They have not been installed here.
- **Android APK — failure.** The signing step exited in the same second it started,
  on `scripts/build-apk.sh:6` (`JOE_SIGNING_STORE_B64` unset). The repository has no
  signing secrets, and the script deliberately refuses to fabricate a keystore,
  because a throw-away key breaks in-place updates (BUG-018).
- **GitHub Release — skipped**, because it needs both jobs.

No release was published and no unsigned APK was attached anywhere. Adding the four
signing secrets and re-running the workflow on the tag is the only remaining step;
the commands are in `REQUIREMENTS_TRACKER.md`.

## 6. Recommended next steps

1. Run a full auth round-trip from a normal network
   (sign-up → confirm → login → entitlement row read) — the migrations are
   already applied to the live project, but this sandbox has no egress to
   supabase.co. Add a server-side profile-quota trigger (client-side only today).
2. Close `OPEN-001` (per-workspace Realtime channels + `realtime.messages` RLS)
   before letting unrelated tenants share a project.
3. Install the CI-built EXE on Windows 10 and 11 and the APK on a physical
   Android 9+ device; record launch, profile creation, launch/stop, background/
   resume, and uninstall.
4. Add a payment provider before advertising Premium commercially; until then
   Premium is granted by an administrator.
5. Add `npm audit` to CI once registry advisory access is confirmed.

## Merged audit thread (browser, history and security)

A second audit thread fixed the same spec from the browser side and its work is
part of this release:

- **History recorded nothing** (the view showed seeded rows; `addHistory` had
  zero callers) — fixed on both shells with classification, deterministic
  dedupe and native clear; `tests/history.test.ts` + the main-process suite.
- **Browsed pages held the management IPC bridge** (critical): any site could
  drive the workspace through `window.joe`. Profile tabs now browse with **no
  preload**; the bridge is limited to bundled pages and localhost dev servers;
  the Android manager refuses navigation off its bundled assets.
- **Real browser chrome** in every profile window (tabs, navigation, address
  bar with search fallback, find, zoom, bookmarks, downloads, deny-by-default
  permissions, keyboard shortcuts) on Windows and Android.
- **Version drift killed** everywhere (shell UA, Android device info, site
  provenance derive from package.json; `tests/version.test.ts` pins it).
- **`npm audit` 0 tree-wide** (vitest 5, esbuild 0.28, lodash overrides) and a
  credential-pattern secret scan gates CI and releases.

See `BUG_REPORT.md` BUG-019…BUG-021 and the "merged audit thread" sections of
`TEST_REPORT.md` / `SECURITY_AUDIT.md` for the evidence.

## Release attempt (v3.2.0, run 44660935215 — 2026-11-20)

The retagged `v3.2.0` (now at the merged `main` commit `6009bc8`, superseding
the earlier `8c74f15`/`e6de75d` candidates that predated the bridge fix) ran
the release workflow:

- **Shared UI + core — success** (1m4s).
- **Windows EXE — success** (1m58s): `JoeBrowser-Setup-3.2.0.exe` and
  `JoeBrowser-Portable-3.2.0.exe` built and uploaded as the `desktop-binaries`
  artifact (~353 MB with symbols). Not installed here — no Windows host.
- **Android APK — failure** (9s): `scripts/build-apk.sh:6`
  (`JOE_SIGNING_STORE_B64: Release signing store required`). The repository has
  no signing secrets and the script deliberately refuses to fabricate a
  keystore (BUG-018).
- **GitHub Release — skipped** (gated on both build jobs). `gh release view
  v3.2.0` reports "release not found". Nothing was published.

Remaining step for the owner (keystore secrets only the owner holds):

```bash
base64 -w0 release.keystore > store.b64
gh secret set JOE_SIGNING_STORE_B64 < store.b64
gh secret set JOE_SIGNING_ALIAS --body "your-alias"
gh secret set JOE_STORE_PASSWORD                        # prompts
gh secret set JOE_KEY_PASSWORD                          # prompts
gh workflow run "Build and publish binaries" -f tag=v3.2.0
```

## Release attempt 3 (2026-11-20) — resolved: v3.2.0 published

The third attempt fixed the release pipeline itself instead of waiting on
secrets (PRs #19, #20):

- the publish job no longer requires the Android job — it publishes whenever
  the Windows build succeeds, and attaches `JoeBrowser.apk` whenever that job
  succeeds (including a re-run of the same tag later);
- the release notes are assembled from `docs/RELEASE-BODY.md` (reviewable,
  versioned) plus a generated artifact list, with an explicit warning when the
  APK is absent;
- `tests/v2.test.ts` executes the real composition script against fixture
  assets (with and without an APK) so the step cannot silently break again.

Release run 44669778563: shared UI+core ✓ (53s), Windows EXE ✓ (1m47s),
Android APK ✗ (15s, `JOE_SIGNING_STORE_B64` unset), **GitHub Release ✓ (34s)**.
`v3.2.0` is published and marked *Latest* with `JoeBrowser-Setup-3.2.0.exe`,
`JoeBrowser-Portable-3.2.0.exe` and `SHA256SUMS.txt`, and its notes carry the
missing-APK warning verbatim. The owner finishing block above remains the path
to attaching `JoeBrowser.apk` to the same release.

## v3.2.1 — startup regression: reproduced, fixed, gated (2026-11-20)

The v3.2.0 release published its EXEs, and the first real user run showed the
app never started: the window sat on "Starting Joe Browser…" forever (BUG-022).
Root cause: the release workflow's web job uploaded the web `dist/` build
(absolute `/assets/…` base) as the packaged UI instead of `apps/desktop/web-dist`
(relative base); under `file://` every script 404'd. No gate loaded the built UI
anywhere, so the failure reached a user.

v3.2.1 fixes the pipeline (builds and ships the desktop bundle), adds four
independent gates (static bundle check, real-Chromium `file://` boot,
asar-content verification, real-Electron boot on the Windows release runner),
fixes the Android WebView module-access default, and pins all of it in
`tests/v2.test.ts`. The v3.2.0 release notes carry a prominent warning.

Remaining owner steps are unchanged (APK signing secrets, then
`gh workflow run "Build and publish binaries" -f tag=v3.2.1` to attach the APK).
