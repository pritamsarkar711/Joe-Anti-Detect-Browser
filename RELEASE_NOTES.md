# Joe Browser 3.2.0

**Accounts are real in this release.** The previous build showed a sign-in form
that never contacted a server: any password was accepted, and typing the owner's
email address unlocked the owner plan. That is fixed, and the plan now comes from
the database.

Artifacts are built by `.github/workflows/release.yml` from a tagged commit:

| Platform | File | Notes |
|---|---|---|
| Windows 10/11 | `JoeBrowser-Setup-3.2.0.exe` | NSIS installer, per-user, install directory selectable |
| Windows 10/11 | `JoeBrowser-Portable-3.2.0.exe` | Portable, no install |
| Android 9+ (API 28) | `JoeBrowser.apk` | `versionCode 6`, sideload |

`SHA256SUMS.txt` accompanies every release; verify it before running anything.
This document does **not** claim those binaries were produced or installed in the
session that wrote it — see "What was not verified" below.

---

## Highlights

### Authentication and entitlement

- **Real Supabase authentication** — sign-up, password login, password reset,
  refresh-token rotation and sign-out. Failures are specific ("that email and
  password do not match an account", "confirm your email first") instead of a
  false success.
- **No local privilege.** Administrator rights require a session verified by the
  server **and** a role assigned by the server. Typing the owner address grants
  nothing. A Premium plan written into `localStorage` is ignored on reload — this
  is now an automated end-to-end assertion, not a promise.
- **Plans are server-owned.** The app reads `my_entitlement()`; the `entitlements`
  and `app_admins` tables have no user write policy. The in-app "Unlock Premium"
  button is gone, and nothing pretends a payment happened.
- **Quota enforced twice.** In the shared core for UX, and in Postgres by a
  `before insert` trigger so an API client cannot exceed the plan. CSV and
  workspace import — previously a one-click bypass — now respect the limit too.

### Database

`supabase/migrations/0002_entitlements.sql` (apply it before signing in):

- creates a personal workspace and owner membership for every auth user, with a
  backfill for existing accounts — without this, RLS made the cloud feature
  permanently empty;
- adds `entitlements` and `app_admins` with read-only access for users;
- adds `my_entitlement()`, `is_admin()` and `enforce_profile_quota()`, all
  `SECURITY DEFINER` with `search_path` pinned and `public` execution revoked;
- scopes primary keys to `(workspace_id, id)`, because profile ids are
  deterministic and two users creating "Profile 001" collided;
- ends with a check that fails if row-level security is missing on any table.

### Android sync

The phone's PostgREST client now sends the signed-in user's session token instead
of the anon key, lets the database resolve the workspace, and no longer reports a
command as sent while signed out or after a failure. Previously every write was
refused by RLS and the UI still showed success.

### Product honesty

- **"Five bundled engines" removed.** One Chromium engine is bundled (Electron on
  Windows, WebView on Android); Joe Browser, Chrome, Edge and Brave are compatible
  identities on it. **Firefox is not offered**, because it is Gecko and a Firefox
  user agent on Chromium is a contradiction a detector can see in one call. The
  picker states this.
- The owner email is no longer displayed in the sign-in form.
- Version metadata is consistent again (`3.2.0`; the desktop shell had been
  reporting `3.1.0`).

### Reliability and evidence

- `npm run test:ui`, `npm run test:devices` and `npm run screenshots` start their
  own server and shut it down; they work on a clean checkout.
- A failed device run no longer overwrites the committed `report.json` with a
  "connection refused" result.
- New tests: 21 for the account client, 12 schema/secret invariants, 2 security
  regressions, 2 rewritten end-to-end checks.

---

## Upgrade from 3.1.1

1. Install the new build over the old one (settings and profiles are preserved;
   the workspace key is unchanged).
2. Apply `supabase/migrations/0002_entitlements.sql` to your project
   (`supabase db push`, or paste it into the SQL editor).
3. Settings → Sync: paste the project URL and the **publishable (anon)** key. A
   service-role key is refused — it must never be in a client.
4. Sign in from Account & plan. Until you do, the app runs on the local free tier
   and says so.

If step 2 is skipped, the account screen reports that the project is missing
`my_entitlement()` and stays on the free tier instead of guessing.

## Validation

Executed in the session that produced this release (Debian, Node 22; no JDK,
Android SDK, Electron runtime, Postgres or device):

`tsc` clean · `npm test` 87/87 · `test:ui` 37/37 · `test:devices` 75/75 ·
`test:fingerprint` 29/29 · `test:site` 15/15 · `test:java` 4/4 (parse only) ·
`test:icons` 8/8 · `test:desktop` 10/10 · `check:bridges` 6/6 ·
`test:packaged` 4/4 · `test:main` 14/14 · `test:ui-desktop` 5/5.

Full detail: [`TEST_REPORT.md`](TEST_REPORT.md),
[`SECURITY_AUDIT.md`](SECURITY_AUDIT.md),
[`PROJECT_AUDIT.md`](PROJECT_AUDIT.md),
[`REQUIREMENTS_TRACKER.md`](REQUIREMENTS_TRACKER.md),
[`BUG_REPORT.md`](BUG_REPORT.md).

## What was not verified

- **No Windows or Android binary was built or installed** in the session that
  wrote these notes; the release workflow does that on GitHub runners.
- **Neither migration was executed** against Postgres, and no live Supabase
  request was made. Schema guarantees are checked statically.
- **No physical device or emulator** was used. The 75 "device" checks are headless
  Chromium viewports with mobile emulation, portrait only.
- **No third-party detector score** is claimed. None was reachable from the build
  sandbox, and a score would describe the engine, not this code.

## Known limitations

- The desktop Realtime channel uses the fixed name `joe-sync` and the anon key, so
  someone else holding that key could publish into it. Use one project per tenant
  until this is closed (tracked as OPEN-001 in `BUG_REPORT.md`).
- Workspaces live in `localStorage`; the `profiles`/`proxies` tables are
  provisioned but not written by the app. Export/import is the supported way to
  move a workspace between devices.
- **No payment provider.** Premium is granted server-side by an administrator.
- Profile **proxies are assigned for real, but health/latency values are
  modelled**, not dialled.
- Engine-level surfaces (TLS/JA4, HTTP/2 frame order, QUIC, font rasterisation, GPU
  behaviour, CDP) remain engine-controlled. Joe Browser is a JavaScript-surface
  (L3) tool and **is not undetectable**.

## Licence

Source: MIT. Documentation and brand assets: CC BY-ND 4.0. See [`LICENSE`](LICENSE),
[`NOTICE`](NOTICE), [`TRADEMARK.md`](TRADEMARK.md) and
[`docs/IP-POLICY.md`](docs/IP-POLICY.md). Third-party names and marks belong to
their owners and are used for identification only.
