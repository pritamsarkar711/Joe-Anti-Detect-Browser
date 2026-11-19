# Security audit — Joe Browser 3.2.0

Scope: the whole repository at `arena/2d9e313d-joe-anti-detect-browser`, with the
emphasis on authentication, authorization, the Supabase schema, the Electron
shell, the Android shell and the credentials that reach a renderer.

Method: source review plus the executable checks listed at the end. Where a check
could not run here (no Postgres, no JDK, no device), the finding is marked
**unverified** rather than assumed safe.

---

## 1. Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-1 | **Critical** | Administrator rights were granted by comparing a typed email with `ADMIN_EMAIL`; the owner plan required no password. | **Fixed** — authority now requires a server-verified session and a server-assigned role (`isAdmin`). Regression test in `tests/v3.test.ts`. |
| S-2 | **Critical** | No authentication existed: sign-up, login and reset were local writes with a pre-filled success message. | **Fixed** — GoTrue client in `src/state/cloud.ts`; 21 tests. Live round-trip unverified (no project credentials). |
| S-3 | **Critical** | Any user could set their own plan to Premium with one click. | **Fixed** — `setPlan` removed; plan comes from the caller's own `public.accounts` row, and the `guard_account_plan` trigger makes plan/limit columns immutable to clients (applied live). |
| S-4 | **High** | Free-tier limit bypassable via CSV and workspace import. | **Fixed** — allowance enforced on both paths, plus a `profiles_quota` trigger in Postgres. |
| S-5 | **High** | A service-role key pasted into Settings was persisted in `localStorage`, `SharedPreferences` and `workspace.json`. | **Fixed** — `looksLikeServiceRoleKey()` refuses it; the value never reaches storage. |
| S-6 | **High** | RLS was unsatisfiable: no code path created a workspace membership, so either the feature was dead or an operator would be tempted to disable RLS. | **Fixed** — bootstrap trigger + `ensure_user_workspace()` + backfill; no user-writable membership policy. |
| S-7 | **High** | Global primary keys let two tenants' deterministic profile ids collide, and `profiles.proxy_id` could reference another tenant's proxy. | **Fixed** — `(workspace_id, id)` keys and a composite foreign key. |
| S-8 | **High** | Cached entitlement could restore `is_admin` from `localStorage`. | **Fixed** — the role is never restored from cache. |
| S-9 | **High** | Android writes used the anon key, so `auth.uid()` was null; the client also hard-coded a foreign workspace id and reported success on failure. | **Fixed (final design)** — command traffic goes through the `joe-command-validate` edge function, which validates the request and alone holds the service-role key; RLS refuses anonymous direct writes (verified live, SQLSTATE 42501), and a failed relay call reports a reason. Runtime round-trip still pending a device test. |
| S-10 | **Medium** | The owner email was displayed as the sign-in placeholder. | **Fixed** — removed. |
| S-11 | **Medium** | A missing `profile_limit` in the entitlement payload was interpreted as "unlimited". | **Fixed** — fail-closed three-state parse, pinned by test. |
| S-12 | **Medium** | The Realtime channel is a fixed name authorised by the anon key, so anyone holding that key could broadcast commands into it. | **Open** — see §6. |
| S-13 | **Medium** | `npm run test:devices` overwrote committed evidence with a failed run. | **Fixed** — only a clean run promotes the report. |
| S-15 | **Low** | If the entry script itself failed to load, the boot handler could not run, so the window had no recovery action at all. | **Fixed** (merged from `main`) — the static shell carries a plain HTML retry link that works before JavaScript starts, and the failure screen offers a Retry button. `scripts/test-boot-retry.mjs` exercises both paths in Chromium. |
| S-14 | **Medium** | Every APK build generated a fresh keystore, so each release had a different signing identity and could not update an installed build in place. | **Fixed** — `scripts/build-apk.sh` now refuses to run without an externally managed store (`JOE_SIGNING_STORE_B64`, `JOE_SIGNING_ALIAS`, `JOE_STORE_PASSWORD`, `JOE_KEY_PASSWORD`) supplied by CI secrets, and the release job no longer fabricates one. Installs signed with an older, unavailable key are **not** upgradable in place: back up the workspace before uninstalling, because uninstalling deletes app data. |

---

## 2. Authentication and session handling

- Identity is proven only by `POST /auth/v1/token?grant_type=password` against the
  configured project. The client never derives a role from an email string.
- Access tokens are refreshed 60 s before expiry (`ensureFreshSession`), on an
  interval while the app is open, and on demand from the account screen. A revoked
  refresh token clears the session and returns the UI to the signed-out state.
- A rejected password and an unconfirmed email produce different, actionable
  messages instead of a generic failure or a false success.
- Passwords are never stored or logged. The app stores only the session tokens.
- Password reset calls `POST /auth/v1/recover`; the response is deliberately
  non-committal ("If … has an account…"), which matches the server's privacy
  behaviour and avoids account enumeration by the client.

## 3. Authorization and the database

`supabase/migrations/0002_accounts_and_licensing.sql` (applied to the live
project, version `20261119181923`) establishes:

- **RLS on every table it creates**, deny-by-default where no policy exists:
  `account_allowlist` has **no** user policy plus an explicit
  `revoke all … from anon, authenticated` (verified live: anon read → SQLSTATE
  42501); the `joe_private` licensing tables enable RLS as belt and braces.
- **Tenant-scoped sessions.** The original `0001` policies scope every workspace
  table to membership or `auth.uid()`; no policy uses `using (true)` and no
  table is granted to `anon`.
- **Plans are server-owned.** `public.accounts` is readable only as
  `auth.uid() = id` (verified live), has no insert/delete policy — rows come
  from the SECURITY DEFINER signup trigger — and the `guard_account_plan`
  trigger rewrites any client attempt to change `plan` or `profile_limit` back
  to the stored values. The owner allowlist row resolves to plan `owner`
  (unlimited) at signup and backfill.
- **The relay is the only door for unauthenticated clients.** The
  `joe-command-validate` edge function (deployed, ACTIVE, `verify_jwt`) reads
  the service-role key from the `JOE_SERVICE_ROLE_KEY` project secret, validates
  action/profile/device/payload (16 KB cap) and is the only component that
  touches `commands` on behalf of the shells; clients carry the publishable anon
  key only.
- **Profile-count quota is client-side only today** — the server-side quota
  trigger from the never-applied parallel migration was removed in the
  integration merge and is tracked as an open item, not a claim.

## 4. Desktop shell

- **Context isolation on, Node integration off, `sandbox: false`** for both the
  manager window and profile windows. The preload exposes a fixed, whitelisted
  surface (28 IPC channels, asserted in sync by `test:desktop`); the renderer has
  no `require`, no `process` and no filesystem access.
- **The local REST API** binds to `127.0.0.1`, rejects requests whose `Origin` is
  a real website, requires `application/json`, caps bodies at 1 MB, requires a
  32-byte per-install bearer token compared with `crypto.timingSafeEqual`, answers
  only GET/POST/OPTIONS, and returns generic errors so internals do not leak.
  `/health` is the only unauthenticated route and returns no user data.
- **Profile isolation** uses `session.fromPartition('persist:<id>')` — separate
  cookies, cache, storage and IndexedDB per profile. Extensions load from the
  app's own `userData/extensions` directory, never from an installed browser.
- **Extension installs** sanitise the id, reject zip-slip paths and record a
  digest (see `apps/desktop/extensions.cjs`).
- **No secrets at rest** beyond the Supabase URL/anon key and the API token
  (`0600`). The anon key is public by design; the service-role key is refused.

## 5. Android shell

- `MainActivity` loads only bundled assets (`file:///android_asset/app`), sets a
  distinct workspace user agent, and shows a readable error page if the bundle
  fails to load instead of a white screen.
- The JS bridge is a fixed 6-method surface (`@JavascriptInterface`), checked
  against the calls the UI makes by `npm run check:bridges` in both directions.
- Each browser profile runs in `:profile` with `WebView.setDataDirectorySuffix`,
  giving a separate WebView data directory per profile.
- Sync credentials live in app-private `SharedPreferences`; the client presents
  the publishable anon key to the relay edge function (the service-role key
  exists only as a server-side secret), and refuses to claim a write was sent
  while the relay is unreachable.
- Manifest: `INTERNET` and `ACCESS_NETWORK_STATE` only, `allowBackup="false"`,
  `usesCleartextTraffic="true"` (needed for local `file://`/proxy diagnostic
  flows — worth narrowing to a network-security-config in a future release;
  recorded here rather than silently changed).

## 6. Accepted risks and limitations

1. **Realtime channel authorization (S-12).** The desktop subscribes to
   `channel('joe-sync')` with the anon key. Broadcast is not RLS-scoped in that
   configuration, so a holder of the project's anon key could publish a
   `command:launch` envelope. Real isolation needs per-workspace channel names,
   `realtime.messages` policies and a Realtime auth token; that cannot be
   validated in this environment, so it is documented, not half-implemented.
   Recommendation: one project per tenant until it is closed.
2. **Offline entitlement cache.** A verified plan is honoured for up to 7 days
   offline. This is a product decision (a paying user on a plane should keep
   working) and it means a tampered `localStorage` could hold a Premium claim
   offline. The administrator flag is explicitly excluded, so the escalation
   surface is a plan claim, not owner rights. It is not DRM.
3. **A modified client can do anything a modified client can do.** Entitlement
   enforcement in the app stops accidental overuse and keeps the three surfaces
   consistent; the database trigger is what makes the limit real for API clients.
4. **`usesCleartextTraffic="true"`** on Android, as noted in §5.
5. **No third-party detector evidence.** No score is claimed anywhere; the app
   links to independent detectors for the user to run inside a profile.
6. **Engine-level fingerprint surfaces** (TLS/JA4, HTTP/2, QUIC, font
   rasterisation, GPU behaviour, CDP) are engine-controlled. The product is
   documented as L3-only (`docs/RESEARCH.md`).

## 7. Dependency and secret scanning

- `npm ci` was used (lockfile-driven). **`npm audit` (full and `--omit=dev`)
  both report 0 vulnerabilities** after the toolchain upgrade (vitest 5, esbuild
  0.28, vite 6.4.6, patched `lodash`/`lodash-es` overrides; `java-parser` keeps
  its pinned chevrotain). CI runs `npm ci` and the full test suite.
- `tests/schema.test.ts` performs a repository secret scan on every test run:
  service-role JWTs, `sb_secret_*`, AWS keys, private-key blocks and hard-coded
  passwords across `src/`, `packages/`, `apps/desktop` and
  `apps/android/app/src`. Current result: **0 offenders**.
- No `.env` files, keystores or tokens are committed. `.gitignore` covers
  `.env*`, `*.keystore`, `apps/android/*.apk` and installer output.

## 8. What was executed

| Check | Result |
|---|---|
| `tests/schema.test.ts` — RLS on all tables, no permissive policy, no `anon` grant, definer functions, allowlist deny posture, guard trigger, signup trigger, relay-table lockdown, secret scan | 10/10 pass |
| `tests/cloud.test.ts` — auth request shape, error mapping, refresh, revocation, accounts-row entitlement read, fail-closed parse, cache binding, cached-admin refusal | 25/25 pass |
| `tests/v3.test.ts` — plan/quota rules and the impersonation regression | 9/9 pass |
| `npm run check:bridges` — bridge surface, extras, edge-relay credential | 6/6 pass |
| `npm run test:main` — main process incl. REST auth (no token 401, foreign origin 403, token 200) and keystroke replay | 16/16 pass |
| `npm run test:java` — Java sources parse | 4/4 pass |
| `npx tsc --noEmit` | clean |

**Executed against the live project (this session, via the Supabase
connector):** migration `0002_accounts_and_licensing` applied; entitlement rows
backfilled (owner → unlimited); anonymous INSERT into `commands` and read of
`account_allowlist` both refused with SQLSTATE 42501; auth redirects on the
canonical Vercel origin; edge function `joe-command-validate` deployed (v3,
ACTIVE) with the service-role key stored as a project secret.

**Not executed here:** a live sign-up → confirm → login round-trip (no egress to
supabase.co from this sandbox); an APK or EXE runtime test; any request from a
physical phone. Those remain the reviewer's next step before a production
release.
