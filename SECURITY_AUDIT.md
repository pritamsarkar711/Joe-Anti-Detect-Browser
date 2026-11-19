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
| S-3 | **Critical** | Any user could set their own plan to Premium with one click. | **Fixed** — `setPlan` removed; `entitlements` is read-only to users; plan comes from `my_entitlement()`. |
| S-4 | **High** | Free-tier limit bypassable via CSV and workspace import. | **Fixed** — allowance enforced on both paths, plus a `profiles_quota` trigger in Postgres. |
| S-5 | **High** | A service-role key pasted into Settings was persisted in `localStorage`, `SharedPreferences` and `workspace.json`. | **Fixed** — `looksLikeServiceRoleKey()` refuses it; the value never reaches storage. |
| S-6 | **High** | RLS was unsatisfiable: no code path created a workspace membership, so either the feature was dead or an operator would be tempted to disable RLS. | **Fixed** — bootstrap trigger + `ensure_user_workspace()` + backfill; no user-writable membership policy. |
| S-7 | **High** | Global primary keys let two tenants' deterministic profile ids collide, and `profiles.proxy_id` could reference another tenant's proxy. | **Fixed** — `(workspace_id, id)` keys and a composite foreign key. |
| S-8 | **High** | Cached entitlement could restore `is_admin` from `localStorage`. | **Fixed** — the role is never restored from cache. |
| S-9 | **High** | Android writes used the anon key, so `auth.uid()` was null; the client also hard-coded a foreign workspace id and reported success on failure. | **Fixed** — session JWT handed to the native client, server-resolved workspace, honest result. Runtime unverified. |
| S-10 | **Medium** | The owner email was displayed as the sign-in placeholder. | **Fixed** — removed. |
| S-11 | **Medium** | A missing `profile_limit` in the entitlement payload was interpreted as "unlimited". | **Fixed** — fail-closed three-state parse, pinned by test. |
| S-12 | **Medium** | The Realtime channel is a fixed name authorised by the anon key, so anyone holding that key could broadcast commands into it. | **Open** — see §6. |
| S-13 | **Medium** | `npm run test:devices` overwrote committed evidence with a failed run. | **Fixed** — only a clean run promotes the report. |
| S-14 | **Low** | The Android debug APK build embeds a fixed keystore passphrase in `scripts/build-apk.sh`. | **Accepted** — the key is generated inside the CI workspace for sideload builds and is not a release-signing secret. A production key must come from CI secrets. |

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

`supabase/migrations/0002_entitlements.sql` establishes:

- **RLS on every table** (`workspaces`, `workspace_members`, `profiles`,
  `proxies`, `devices`, `commands`, `events`, `entitlements`, `app_admins`).
  The migration ends with a `DO` block that raises if any of the nine lacks RLS.
- **Tenant isolation** via membership checks (`exists (select 1 from
  workspace_members m where m.workspace_id = … and m.user_id = auth.uid())`).
  No policy uses `using (true)` and no table is granted to `anon`.
- **Plans are server-owned.** `entitlements` has a SELECT policy for the owner of
  the row and no write policy at all; `app_admins` has no user policy. Both are
  writable only through the service role, which never reaches a client.
- **One authority function.** `my_entitlement()` (SECURITY DEFINER, `search_path`
  pinned, `revoke all … from public`, `grant execute … to authenticated`) returns
  `plan`, `is_admin`, `profile_limit`, `renews_at`, `verified`. An anonymous caller
  gets `verified: false` and the free tier.
- **Quota in the database.** `enforce_profile_quota()` is a `before insert` trigger
  on `profiles`; a direct PostgREST insert above the limit raises
  `check_violation`. It is skipped for the service role and for administrators.
- **No privilege escalation through writes.** `workspace_id` defaults to
  `my_workspace_id()`; a client cannot target a workspace it does not belong to.

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
- Sync credentials live in app-private `SharedPreferences`; the session JWT is
  used as the bearer token so RLS can scope requests, and the client refuses to
  claim a write was sent while signed out.
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

- `npm ci` was used (lockfile-driven). The audit was **not** able to run
  `npm audit --omit=dev` against the registry advisory endpoint in a way that
  produces a report to attach here; CI runs `npm ci` and the full test suite. A
  dedicated `npm audit` job should be added once network access to the advisory
  service is confirmed in CI.
- `tests/schema.test.ts` performs a repository secret scan on every test run:
  service-role JWTs, `sb_secret_*`, AWS keys, private-key blocks and hard-coded
  passwords across `src/`, `packages/`, `apps/desktop` and
  `apps/android/app/src`. Current result: **0 offenders**.
- No `.env` files, keystores or tokens are committed. `.gitignore` covers
  `.env*`, `*.keystore`, `apps/android/*.apk` and installer output.

## 8. What was executed

| Check | Result |
|---|---|
| `tests/schema.test.ts` — RLS on all tables, no permissive policy, no `anon` grant, definer + revoke/grant pairs, quota trigger, bootstrap trigger, composite keys, secret scan | 12/12 pass |
| `tests/cloud.test.ts` — auth request shape, error mapping, refresh, revocation, RPC auth, fail-closed parse, cache binding, cached-admin refusal | 21/21 pass |
| `tests/v3.test.ts` — plan/quota rules and the impersonation regression | 9/9 pass |
| `npm run check:bridges` — bridge surface, extras, session-token handoff | 6/6 pass |
| `npm run test:main` — main process incl. REST auth (no token 401, foreign origin 403, token 200) | 14/14 pass |
| `npm run test:java` — Java sources parse | 4/4 pass |
| `npx tsc --noEmit` | clean |

**Not executed here:** applying either migration to a Postgres database; a live
auth round-trip; an APK or EXE runtime test; any request from a physical phone.
Those remain the reviewer's next step before a production release.
