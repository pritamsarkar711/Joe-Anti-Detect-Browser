# Changelog

All notable changes to Joe Browser. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
semantic versioning for the application as a whole (workspace schema, desktop
shell and Android app ship together).

## [3.2.0] — 2026-11-19

### Security

- **Fixed a critical privilege-escalation path**: administrator rights were
  granted by matching the typed email address against `ADMIN_EMAIL`. They now
  require a server-verified session and a server-assigned role.
- **Fixed the missing authentication**: sign-up, login, password reset, session
  refresh and sign-out now make real requests to Supabase. Previously the form
  accepted any password and never left the device.
- **Removed the one-click "Unlock Premium"**: plans are read from
  `my_entitlement()` and cannot be changed by the client.
- **Enforced the free quota on CSV and workspace import**, which previously
  bypassed it.
- **Refused service-role keys** pasted into Settings instead of storing them.
- **Stopped restoring the administrator flag from the offline entitlement cache**,
  and bound the cache to the account that earned it.
- **Fail-closed entitlement parsing**: a missing `profile_limit` no longer means
  "unlimited".
- **Android sync now authenticates with the session JWT**, so row-level security
  can scope it; the hard-coded foreign workspace id is gone and a failed write is
  no longer reported as sent.

### Added

- `src/state/cloud.ts` — dependency-free Supabase Auth/PostgREST client with typed
  errors, refresh rotation and an offline plan cache.
- `supabase/migrations/0002_entitlements.sql` — workspace bootstrap trigger and
  backfill, `entitlements`, `app_admins`, `my_entitlement()`, `is_admin()`,
  `enforce_profile_quota()`, `(workspace_id, id)` primary keys and a composite
  proxy foreign key.
- `tests/cloud.test.ts` (21 tests) and `tests/schema.test.ts` (12 tests, including
  a repository credential scan).
- `scripts/serve.mjs` — the browser suites now start and stop their own server.
- `PROJECT_AUDIT.md`, `REQUIREMENTS_TRACKER.md`, `BUG_REPORT.md`,
  `TEST_REPORT.md`, `SECURITY_AUDIT.md`, `OPEN_SOURCE_RESEARCH.md`,
  `RELEASE_NOTES.md`, `CHANGELOG.md`, `SECURITY.md`.
- `assets/screenshots/14-account.png`, captured from the running app.

### Changed

- **Engine claim corrected.** One bundled Chromium engine with four compatible
  identities (Joe Browser, Chrome, Edge, Brave). Firefox is declared unavailable
  in the picker, the plans and the README instead of being presented as an engine.
- Creating a profile now shows "Browser identity" and explains that every choice
  runs on the bundled engine.
- `npm run test:ui` and `npm run test:devices` are part of CI; the device matrix
  only replaces its committed report on a clean run.
- Version metadata aligned at `3.2.0` across `package.json`, the desktop shell,
  the Android manifest (`versionCode 6`), the site and the release workflow.

### Fixed

- A failed entry script left a window with no recovery action: the static shell now
  has a retry link that works before JavaScript runs, and the failure screen has a
  Retry button (`scripts/test-boot-retry.mjs`).
- Every APK build used a fresh signing identity, so updates could not install over
  an existing app. The build now requires an externally managed signing store and
  fails loudly without one.
- `npm run test:devices` hung after printing results because `npx` left a Vite
  grandchild holding the inherited pipe.
- `createOne` returned `null as unknown as BrowserProfile`.
- The end-to-end suite relied on the plan-forging vulnerability; it now asserts
  that a forged plan is ignored.

## [3.1.1]

### Fixed

- Windows app failed to start with `Cannot find module './extensions.cjs'`: the
  module was required at import time but omitted from the `app.asar` allowlist.
  It is packaged now, and extension support degrades instead of aborting startup.
- Profile launch did nothing on desktop: the UI and the shell kept separate
  profile lists. `workspace:replace` / `workspace:read` keep them in sync, and a
  refused launch is reported.
- Android launcher icon was invisible (white glyph on white background); the
  splash now draws the logo.
- Supabase credentials entered in Settings never reached the phone's sync service.
- Profiles from an older export crashed on a missing `screen` field.
- Android build: a Java lambda the APK toolchain cannot desugar.

### Added

- Packaging gates (`test:desktop`, `test:packaged`, `check-asar.mjs`), main-process
  and renderer suites (`test:main`, `test:ui-desktop`), brand checks (`test:icons`)
  and bridge checks (`check:bridges`).

## [3.1.0]

- Bundled engines and plan split; new identity ("J" monogram), screenshot gallery,
  mobile device matrix, command palette, grouped navigation, per-profile history,
  extension library, proxy manager, paste-as-human plan.
- **Known defect:** every Windows install failed at launch because a required
  module was missing from the package (fixed in 3.1.1).

## [3.0.0]

- Workspace schema v3 (`joe-browser:v3`), Material UI redesign on IBM Plex Sans
  with a single pink accent, Supabase control plane, per-profile isolation in the
  Electron shell, Android WebView shell with a JS bridge, SEO site.

## [2.0.0]

- TypeScript-first rewrite: shared core, observed-device dataset, coherence
  scoring, CSV/cookie transfer, transport-agnostic sync.

## [1.0.0]

- Initial public source release under MIT.

[3.2.0]: https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/compare/v3.1.1...v3.2.0
[3.1.1]: https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/compare/v3.1.0...v3.1.1
[3.1.0]: https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/releases/tag/v1.0.0
