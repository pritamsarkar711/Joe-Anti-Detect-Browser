# Joe Browser release audit · 2026-11-19 (second checkpoint)

**Decision: continue toward release.** The first checkpoint (see git history)
held the release for startup and signing work, which has since landed on `main`.
This checkpoint audits the codebase end to end against the product requirements,
fixes the defects it found, and records what is still unverified. See
[requirements](REQUIREMENTS_TRACKER.md), [bugs](BUG_REPORT.md),
[tests](TEST_REPORT.md), [security](SECURITY_AUDIT.md),
[research](OPEN_SOURCE_RESEARCH.md) and [release notes](RELEASE_NOTES.md).

## Architecture inspected

Three delivery paths share one React + Material UI workspace: Vite builds the
web bundle, Electron packages it with the desktop main process and preload
bridge, and Android packages a local asset bundle for `MainActivity` and a
separate `:profile`-process `BrowserActivity`. The build invokes SDK tools
directly, not Gradle. `site/` is the SEO landing page Vercel serves — it is not
the native renderer. A green web build cannot validate native asset paths, APK
upgrades or Windows process cleanup; those gates stay native-specific.

## What this pass verified locally

- `tsc --noEmit` clean; `npm test` 74/74 across 8 files (was 51/6 before).
- Every CI gate green: `test:java` 4/4, `test:icons` 9/9, `test:desktop` 8/8,
  `check:bridges` 5/5, `test:site` 15/15, `test:fingerprint` 29/29,
  `test:packaged` 4/4, `test:main` 16/16, `test:ui-desktop` 5/5.
- Real-browser suites against a live dev server: `test:ui` 35/35,
  `test:devices` 75/75 on five Android families.
- Production bundles build for web, desktop, Android and the SEO site.

## What this pass fixed (details in BUG_REPORT.md)

1. **EXE ⇄ APK sync did not work.** The desktop only used Realtime broadcast,
   the APK only polled the `commands` table, and row-level security blocked the
   anon key from that table in both directions. Sync now runs through the
   validated `joe-command-validate` edge function (send / poll / ack) with the
   service-role key; RLS stays locked to clients. The function source is unit
   tested (13 checks) and deployed (v3, ACTIVE).
2. **Cloud auth was advertised but not implemented.** The account screen
   claimed Supabase handled accounts while every path bound an email locally.
   Real sign-up, email confirmation, password sign-in, password reset with
   paste-the-link recovery, session persistence and sign-out now run through
   `@supabase/supabase-js` when keys are configured, with entitlement read
   from the guarded `public.accounts` row. Local mode stays honest and unchanged.
3. **Three auth users had no entitlement row** (they predated the signup
   trigger). Migration `0002_accounts_and_licensing.sql` captures the live
   schema in the repository and backfills those rows; the owner resolves to
   `plan=owner, unlimited=true` through the allowlist.
4. **The desktop reported the wrong version** (`app:info` said 3.1.0 while the
   product shipped 3.1.1). It now reads `package.json`.
5. **"Send to ⟨profile⟩" was a fake button** — it only copied to the
   clipboard. The desktop shell now replays the reviewed schedule through CDP
   `Input.dispatchKeyEvent` with each per-key delay; other platforms say
   "Copy plan" and say so. Invalid plans and closed windows are refused with
   reasons, covered by a new main-process smoke check.
6. **Two conflicting brand identities.** The generator still emitted the
   retired ring-and-dot, so the README header and favicons disagreed with the
   app's J monogram. The generator now emits the `Brand.tsx` geometry and
   `test:icons` fails if any published mark drifts again.
7. **Email confirmation/reset links pointed at `http://localhost:3000`.**
   Supabase `site_url` and redirect allow-list now use the canonical
   `https://joe-browser-control.vercel.app`.
8. **Dependency audit: 11 vulnerabilities (2 critical) → 0.** All were
   dev-toolchain (vitest/tinypool, esbuild, lodash via java-parser). Fixed by
   upgrading vitest 5, esbuild 0.28, vite-node, and pinning patched
   `lodash`/`lodash-es` overrides; `java-parser` keeps its pinned chevrotain
   (12+ breaks its API) whose exposure was only through lodash-es.
9. Stale site-branch default, a demo activity row claiming "24 profiles" in a
   six-profile workspace, and Settings copy that promised cloud auth before it
   existed.

## Verified live against the Supabase project

- Migration `accounts_and_licensing` applied; signup trigger present; three
  backfilled entitlement rows (owner → `owner`/unlimited, two → `free`/2).
- **RLS denial proven**: an `anon` INSERT into `commands` fails with SQLSTATE
  42501 — clients cannot touch the relay tables.
- Edge function `joe-command-validate` deployed (v3, ACTIVE, `verify_jwt`);
  service-role key stored as the project secret `JOE_SERVICE_ROLE_KEY`.
- Auth config: sign-up enabled, email confirmation required, canonical
  redirect URL. `npm audit --omit=dev` and full `npm audit` both report 0.

## Not verified in this environment (honest gaps)

- The deployed edge function was **not invoked end to end** from here: this
  sandbox only reaches github/npm/pypi hosts. Its handler is unit-tested, but
  a real EXE⇄APK round trip still needs one desktop + one phone on the same
  Supabase project.
- No Windows host, no Android device/emulator, no JDK/SDK here: native
  install, launch, lifecycle and performance claims stay with CI artifacts and
  the acceptance checklist. Nothing is marked complete without that evidence.
- Supabase sign-up/sign-in against the live project was not exercised from
  here (same network restriction). The flows are wired to the official client
  and the GoTrue configuration is correct; first real sign-in should be
  watched from a normal network.
- Screenshots in `assets/screenshots` are real captures; the device settings
  captures were refreshed this pass. No capture shows the account screen —
  none is claimed to.
