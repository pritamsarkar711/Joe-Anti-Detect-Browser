# Requirement groups

Phase-level index against the master prompt, plus the checkpoint evidence tables
below. Unless evidence is linked, the result is **not verified**.

Status key for evidence tables: **Verified** — locally reproduced with automated
evidence; **Partly verified** — implemented with automated evidence and a named
real-environment check still outstanding; **Not verified** — implemented but no
automated evidence in this environment; **Blocked** — cannot be produced here.

## Phase index (22-phase master prompt)

|Phase / requirement|Status|Location, gap and next verification|
|---|---|---|
|1–2 inventory and audit|PARTIALLY IMPLEMENTED|PROJECT_AUDIT.md; expand to individual controls, permissions and tests.|
|3 startup recovery|VERIFIED (web/desktop)|index.html and src/boot.tsx; packaged-app boot test covers both web failure paths and the extension preloader. Repeat on both installed shells, including offline cold start.|
|4 engine|PARTIALLY IMPLEMENTED|apps/desktop, apps/android; inspect packaged runtime version on clean Windows and supported WebView versions on Android.|
|5 profiles and devices|PARTIALLY IMPLEMENTED|packages/core, src/state; run CRUD, import/export and two-profile storage/clear tests on each engine.|
|6 privacy|PARTIALLY IMPLEMENTED|packages/fingerprint; verify actual engine capabilities and stability; no diagnostic score recorded.|
|7 proxies|PARTIALLY IMPLEMENTED|packages/core/src/proxy.ts; test credentials, timeout, isolation and failure without fallback to direct traffic.|
|8 extensions|PARTIALLY IMPLEMENTED|apps/desktop/extensions.cjs; verify consent, integrity, removal and engine-specific compatibility.|
|9 history and controls|PARTIALLY IMPLEMENTED|src/ui and native shells; Paste-as-human send path now real and smoke-tested; compare two profiles after restart and exercise individual controls.|
|10–11 accounts, administration, plans|PARTIALLY IMPLEMENTED (this checkpoint: cloud auth + server entitlement implemented)|Real Supabase auth wired (`src/state/auth.ts`), migration `0002` backfills entitlements, `guard_account_plan` blocks self-serve escalation, anon RLS denial proven (42501). First live sign-up and a cross-user denial test in staging still outstanding. No payment or admin provisioned.|
|12 UI|PARTIALLY IMPLEMENTED|src/theme.ts, src/styles.css; keyboard, overflow and modal walkthrough pending.|
|13 Android compatibility|BLOCKED BY TECHNICAL LIMITATION|No adb on PATH; run install, resume, rotation and upgrade matrix with OS and WebView versions.|
|14 Windows performance|BLOCKED BY TECHNICAL LIMITATION|No native Windows host here; measure cold/warm launch, idle CPU, peak RAM and subprocess count after shutdown.|
|15 security|PARTIALLY IMPLEMENTED (dependency audit now clean)|See SECURITY_AUDIT.md; `npm audit` = 0 (prod + dev) after vitest 5 / esbuild 0.28 / lodash 4.18.1 overrides. Signing and live E2E remain open.|
|16 testing|PARTIALLY IMPLEMENTED|See TEST_REPORT.md; full native and auth E2E outstanding.|
|17 workflows|PARTIALLY IMPLEMENTED|.github/workflows; recovery test in CI, signing positive path outstanding.|
|18 production artifacts|BLOCKED BY TECHNICAL LIMITATION|No signed candidate validated. Install twice with identical signer and verify data survives upgrade.|
|19 docs and licensing|PARTIALLY IMPLEMENTED|README, NOTICE, docs and assets/screenshots; reconcile claims and provenance against tested builds.|
|20 research|PARTIALLY IMPLEMENTED|See OPEN_SOURCE_RESEARCH.md; supabase-js adopted for cloud auth with license/provenance recorded.|
|21 acceptance|PARTIALLY IMPLEMENTED|No end-to-end platform acceptance recorded; keep publication gated.|
|22 publication|MISSING|No new release, merge or verified attachments at this checkpoint.|

## 2026-11-19 second checkpoint — feature evidence

| Requirement | Status | Evidence / next step |
|---|---|---|
| Production Windows installer and portable EXE | Not verified | `.exe` and `.zip` exist as **unsigned** artifacts from `release.yml` (no signtool step in CI) with `SHA256SUMS.txt` checksums; needs a Windows host for install/launch and, for public trust, a purchased code-signing certificate wired into the workflow. |
| Production Android release APK | Not verified | `release-unsigned.apk` builds and `scripts/apk-check.mjs` verifies it; Gradle was not run here (no JDK). Needs a Windows/Linux builder with the SDK. |
| Cloud sign-up / sign-in / reset | Partly verified | Real GoTrue calls wired through `@supabase/supabase-js` (`src/state/auth.ts`), `tests/auth.test.ts` 10/10, `tsc` clean, build green. Live sign-in from this sandbox was blocked (no network to supabase.co) — first confirmation-link flow to be watched on a normal network. |
| Server-enforced entitlement | Verified | Migration `0002` live: `guard_account_plan` BEFORE UPDATE trigger blocks any self-serve plan/limit change; owner row resolves to `owner`/unlimited; anon `INSERT` into `commands` denied 42501 on the live database. |
| EXE ⇄ APK sync | Partly verified | Edge function `joe-command-validate` deployed (v3, ACTIVE, service-role secret), desktop relay client and Android `SyncHttp`/`SyncPoller` rewritten, 13 unit tests + main-process smoke checks green (invalid plans and closed windows refused). One real EXE + one phone round trip is still outstanding — this sandbox cannot reach supabase.co. |
| Human-paced text entry (Paste as human) | Verified | Desktop `keystrokes:send` replays the reviewed schedule via CDP with per-key delays; smoke check dispatches char/Backspace events and refuses bad plans; non-desktop platforms label the button "Copy plan". Accessibility text entry only — CAPTCHA challenges stay with a person. |
| No secrets shipped | Verified | The service-role key exists only as a Supabase project secret used by the edge function; the shipped apps carry the anon key only; `npm audit --omit=dev` = 0. |
| Branding consistency | Verified | Generator now emits the `Brand.tsx` J monogram; `test:icons` fails if any published mark drifts; `assets/brand/joe-browser.svg` and both favicons match. |
| Dependency vulnerabilities | Verified | `npm audit` (prod + dev) = **0** after vitest 5 / esbuild 0.28 / vite 6.4.6 / lodash 4.18.1 overrides; `java-parser` keeps its pinned chevrotain. |

## 2026-11-19 first checkpoint — release gate evidence (retained)

| Requirement | Status | Evidence / next step |
|---|---|---|
| Startup crash and white screen | Verified | The extension preloader is wrapped, the React root is mounted inside `boot()`, and the packaged-app boot test proves both. |
| Release version and product naming | Verified | `package.json` is `3.1.1` and every shipped surface reports it; the desktop IPC that reported `3.1.0` now reads the package. |
| `extensions.cjs` packaging | Verified | Electron requires it at startup and electron-builder's allowlist includes it; the release staging check re-reads the real files list. |
| Brand and identity consistency | Verified | The same J monogram geometry drives app chrome, favicon, site, Electron icon and Android adaptive icon; the brand check now enforces the published copies. |
| Android upgrade and process cleanup | Not verified | Android 8+ uses a foreground service for the second process and `android:process` for the profile window. The documented failure mode — the old profile service outliving an upgrade — still needs a real device. |
| Local workspace backup | Not verified | Settings export/import is implemented and UI-tested; a real phone download and re-import remains on the acceptance checklist. |
| Native Android launcher assets | Not verified | APK contains all three density launcher icons, round icon, service declaration and a real `dex` containing the profile process, verified by `scripts/apk-check.mjs`. |
| Windows profile process cleanup | Not verified | `killProfileProcess` refuses to signal PIDs whose path is not under the packaged `profiles/` tree, but a Windows build is required to prove it. |
| Android performance | Not verified | WebView lifecycle, single-instance profile window, foreground service and reduced cold-start surface are implemented. No device timing evidence exists. |
| Browser fingerprints | Not verified | Chromium-based browsers share a fingerprint; per-profile settings and native CDP checks are the only supported compatibility controls. Browser-family fingerprints remain out of scope. |
