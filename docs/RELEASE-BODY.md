## Joe Browser 3.2.0

Binaries are listed at the bottom of these notes. `SHA256SUMS.txt` contains a
checksum for every file in the release — verify it before running anything.

**Accounts are real in this release.** v3.1.1 had a sign-in screen that never
contacted a server: any password was accepted, and typing the owner's email
address in the email box granted the owner plan. That is fixed.

**Highlights in 3.2.0**
- Supabase authentication is implemented: sign-up, password login, password
  reset, refresh-token rotation and sign-out now make real requests. Without a
  configured project the app says so and stays on the local free tier
- Plans and the administrator flag come from the server: the client reads its
  own row in `public.accounts` under row-level security, and the
  `guard_account_plan` trigger makes plan and limit columns immutable to
  clients. There is no in-app upgrade button and no email-based
  administrator check anywhere
- `supabase/migrations/0002_accounts_and_licensing.sql` (applied to the live
  project) adds the deny-all owner allowlist, entitlement rows with a signup
  trigger and backfill, the licensing tables behind `require_user()` /
  `require_admin()`, and an event trigger that re-enables RLS if a future
  migration forgets it
- EXE⇄APK commands flow through the validated `joe-command-validate` edge
  function — action, profile, device and payload checked server-side, and
  only that function ever holds the service-role key (as a project secret)
- "Paste as human" now really types: the desktop replays the reviewed
  keystroke plan through CDP with per-key delays; other platforms copy the
  plan and say so. CAPTCHA challenges stay with a person
- Free-tier quota is enforced on every path that adds profiles, including CSV and
  workspace import, which previously bypassed it
- A service-role key pasted into Settings is refused instead of stored
- `npm run test:ui`, `npm run test:devices` and `npm run screenshots` now start
  their own server and exit cleanly; the device suite no longer overwrites the
  committed evidence report when a run fails
- Real per-profile browsing history: the desktop and Android shells record every
  visit (URL, title, time, search detection) as profiles browse; the History view
  previously showed only seeded demo rows because nothing ever wrote an entry
- Real browser controls in every profile window on Windows and Android: tabs,
  back, forward, reload/stop, home, address bar with search fallback, find on
  page, zoom, per-profile bookmarks, downloads and deny-by-default site
  permissions — plus keyboard shortcuts on Windows
- Security: browsed pages no longer receive the app's IPC bridge — profile
  pages run without a preload and the management bridge is limited to bundled
  pages (a website a profile visited could previously drive the whole workspace
  through `window.joe`); the Android manager WebView refuses to navigate
  anywhere but its bundled assets
- A credential-shaped-string scan now gates CI and releases alongside the
  zero-vulnerability dependency audit
- New tests: 25 for the account client, 10 for schema/secret invariants,
  13 for the relay edge function; the brand guard fails if any published
  favicon or logo drifts from the J monogram
- Version metadata is consistent again (the desktop shell reported 3.1.0 while
  the package said 3.1.1); `npm audit` reports 0 vulnerabilities

**Validation** (this environment: Debian, Node 22, no JDK/Android SDK/Electron):
`tsc` clean; `npm test` 115/115; `test:ui` 37/37; `test:devices` 75/75;
`test:boot` pass (retry works when the entry script itself fails);
`test:fingerprint` 29/29; `test:site` 15/15; `test:java` 4/4 (parse only);
`test:icons` 9/9; `test:desktop` 11/11; `check:bridges` 7/7; `test:packaged` 4/4;
`test:main` 16/16; `test:ui-desktop` 5/5; `npm audit` 0. Migration 0002 was
applied to the live project and its key properties verified there (backfilled
entitlement rows, deny-all allowlist, anonymous writes refused with SQLSTATE
42501); a live sign-up round-trip and a real EXE⇄APK command round trip remain
pending device testing. See `TEST_REPORT.md`, `SECURITY_AUDIT.md` and
`PROJECT_AUDIT.md` for the full evidence and for every item that remains
unverified.

**Engine**: one bundled Chromium engine with four compatible browser
identities (Joe Browser, Chrome, Edge, Brave). Firefox is **not** offered —
no Gecko runtime is bundled, so presenting a Firefox identity would be a
user-agent string on a Chromium engine. The picker says so.

**Honest scope**: profile isolation, fingerprint coherence and history work as
described for the surfaces the app controls. Joe Browser does not ship a patched
Chromium or Firefox kernel, so TLS/JA4, HTTP/2 frame order, QUIC, font
rasterisation, GPU driver behaviour and CDP side channels remain
engine-controlled. It is **not undetectable**, no third-party detector score is
claimed, and the app was not tested on physical Windows or Android devices by
this build environment.

Built by GitHub Actions from tagged source in this repository.
Source: MIT · docs and brand assets: CC BY-ND 4.0 · see NOTICE and TRADEMARK.md.
