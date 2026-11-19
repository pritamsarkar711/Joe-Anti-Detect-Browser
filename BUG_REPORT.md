# Findings

## 2026-11-19 second checkpoint — fixed

- **EXE ⇄ APK sync could not work.** The desktop relied on Realtime broadcasts to a database the anon key cannot write; the APK polled a table row-level security blocks it from reading. Both sides now go through the `joe-command-validate` edge function (send / poll / ack), the only holder of the service-role key. Evidence: 13 function unit tests, main-process smoke checks (invalid plans and closed windows refused), live RLS denial 42501, function deployed v3 ACTIVE. Outstanding: one real EXE⇄APK round trip — this sandbox cannot reach supabase.co.
- **Account screen claimed cloud auth that did not exist.** Every button bound an email locally while promising Supabase handled accounts. Real sign-up, confirmation, sign-in, reset, session persistence and sign-out now run through the official client; local mode keeps working with honest copy. Evidence: `tests/auth.test.ts` (10), `tsc` clean, UI suite green.
- **Three auth users had no entitlement row** (pre-trigger signups). Migration `0002` adds and backfills `public.accounts`; the owner resolves to `owner`/unlimited; `guard_account_plan` blocks client plan escalation. Evidence: live rows inspected; anon insert denial 42501.
- **Desktop `app:info` reported version 3.1.0 while the product shipped 3.1.1.** It now reads `apps/desktop/package.json`. Evidence: `test:main` reports `v3.1.1`.
- **"Send to ⟨profile⟩" was a fake button** that only copied to the clipboard under a doc comment claiming key-event replay. The desktop now replays the reviewed schedule through CDP with per-key delays; elsewhere the button says "Copy plan". Evidence: smoke check dispatches char/Backspace events and refuses bad plans.
- **Two conflicting brand identities.** The generator still wrote the retired ring-and-dot, so the README header and both favicons disagreed with the app's J monogram. Generator fixed from `Brand.tsx` geometry; `test:icons` now fails on any published mark that drifts.
- **Auth confirmation/reset links pointed at `http://localhost:3000`.** Supabase `site_url` and redirect allow-list now use the canonical Vercel origin (verified via `get_auth_config`).
- **Dependency audit: 11 vulnerabilities (2 critical) → 0** (dev-toolchain only). Upgraded vitest 5, esbuild 0.28, vite 6.4.6 and pinned patched `lodash`/`lodash-es`; `java-parser` keeps its pinned chevrotain. Evidence: `npm audit` = 0, all suites re-run green.
- **Stale site-branch default:** the built site linked documentation to a branch that does not contain this work; `build:site` now derives it from `SITE_BRANCH`, then `git`. Evidence: `test:site` 15/15.
- **Demo activity claimed "24 profiles"** in a six-profile workspace; the seed now uses the real profile count.
- **Settings promised cloud auth before it existed** — caption rewritten to describe what is configured today.

## First checkpoint — fixed

- **Startup:** If the entry script itself fails, its catch handler cannot run. The static shell previously offered no action. A plain HTML retry link works before JavaScript starts; the lazy-import failure screen now also offers a non-destructive retry. Tested in Chromium, not a diagnosis of all reported native freezes.
- **APK updates:** Each previous build generated a different signing identity. Android requires a compatible signer for an in-place update. The release script now requires a stable externally managed store. Past installations signed with unavailable keys may not be upgradable; do not suggest uninstalling without warning about data loss.

## Open

- **Proxy status (open):** scripts/generate-android-assets.mjs seeds documentation-range proxy addresses with successful status and latency without a connection test. Separate demo data from production first-run state and verify clean install shows no invented measurements.
- One real EXE⇄APK sync round trip on a normal network; first Supabase sign-up/confirmation observed end to end.
- First-checkpoint native gaps remain: Windows install, Android device lifecycle, Android performance, native upgrade, real-device leak measurement, fingerprint performance.
