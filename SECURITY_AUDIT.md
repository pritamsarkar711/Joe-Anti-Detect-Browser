# SECURITY_AUDIT — Joe Browser 3.2.0

Audit date 2026-11-19. Scope: web control plane, Electron desktop shell,
Android shell, Supabase schema/RLS/Edge Function, CI/CD, dependencies, secret
hygiene. Tooling used: manual review of every auth/IPC/network surface,
`npm audit` (full tree), the repository secret scan (`scripts/check-secrets.mjs`,
7 pattern families), and the packaging/bridge gates that enforce security
properties structurally.

## Critical findings (fixed)

### S-1 · Management IPC bridge exposed to browsed web content — CRITICAL — FIXED
Profile windows attached `preload.js` (exposing `window.joe` with
`workspace:replace`, `profiles:delete`, `sync:configure`, `profiles:launch`,
extension install, …) to the same webContents that browsed arbitrary sites.
Any page opened in any profile could take over the workspace, redirect sync to
an attacker-controlled Supabase project, or launch processes via profile
commands. The Android manager WebView carried `JoeBridge` while permitted to
navigate to remote URLs.
- **Fix:** profile tabs are WebContentsViews with **no preload**;
  `window.joe`/`window.joeChrome` are exposed only to `file:` pages and
  localhost dev servers (remote fallback gets nothing); the Android manager
  refuses any navigation outside `file:///android_asset/` and opens external
  links via the system browser instead.
- **Verification:** `test:main` asserts foreign chrome senders are rejected;
  the trust gate is enforced in `preload.js`; code inspection recorded here.

## High findings (fixed)

### S-2 · Client-only plan/admin enforcement — HIGH — FIXED
Quota and admin checks lived in TypeScript; trivially bypassed. Fixed by
migration `0002`: DB trigger enforces the profile quota on insert and
workspace-move (free 2 / demo 6 / premium-admin unlimited, counted across all
memberships), `user_entitlements` is readable by its owner (or admin) and
**writable by no client role at all**, admin RPCs raise `ADMIN_ONLY`
(errcode 42501), and signup provisioning isolates each user in their own
workspace so 0001's RLS separates data from the first request.

### S-3 · Dependency advisories — HIGH (dev-only) — FIXED
11 advisories (vitest `@vitest/mocker`/`tinypool` prototype-pollution RCE
gadgets, esbuild dev-server origin bypass, lodash/lodash-es via java-parser).
All upgraded/overridden; `npm audit` now reports **0 across the tree**. CI
enforces `npm audit --omit=dev --audit-level=high` so shipped-code advisories
fail builds.

## Medium/low findings (fixed or accepted)

- **S-4 version drift (fixed):** unidentifiable builds complicate incident
  response; every version surface now derives from package.json and is test-
  locked (`tests/version.test.ts`).
- **S-5 fake premium unlock (fixed):** misleading purchase affordance replaced
  with an explicit local preview; no payment surface exists to be abused.
- **S-6 Android cleartext traffic (accepted, documented):**
  `usesCleartextTraffic="true"` remains because a browser must load plain
  `http://` sites the user chooses. Risk is confined to browsed content inside
  the isolated profile; the manager and sync layers speak HTTPS only
  (Supabase), and the manager WebView cannot navigate remotely at all.
- **S-7 extension loading (accepted with controls):** unpacked extension
  loading with `allowFileAccess` is the only engine-supported install path;
  mitigated by zip-slip refusal, manifest validation, SHA-256 digests shown to
  the user, opt-in attach, and installs living in the app's own directory.
- **S-8 local REST API (inspected, sound):** loopback bind, no CORS grants,
  origin allowlist rejects web pages, per-install 32-byte token (0600),
  timing-safe compare, JSON-only bodies with 1 MB cap, generic 500s.

## Data handling

- No telemetry. No secrets in logs (reviewed `console.*` sites — messages carry
  ids and status, never credentials). Proxy passwords appear only in the local
  workspace file and session config, never in UI lists or logs.
- The Supabase anon key is a publishable key by design; the security boundary
  is RLS + server functions. The **service-role key appears nowhere** in the
  repository (secret scan gate).
- Admin identity: the owner-provided address is compared in `is_admin()`
  (SQL) and `ADMIN_EMAIL` (core) with a test that fails if they diverge. Real
  admin authority is the backend `ADMIN_ONLY` functions, not the UI badge.

## Verification pending (operator steps)

These require the live Supabase project or a Windows/Android device and are
**not** claimed as done:

1. Apply `0001`+`0002` (`supabase db push`), then probe: `can_create_profile`
   as a free user (2 allowed), insert a 3rd profile (expect
   `PROFILE_LIMIT_REACHED`), read another user's `user_entitlements` (expect
   empty), call `admin_list_users` as non-admin (expect `ADMIN_ONLY`), as
   admin (expect rows).
2. Walk sign-up → confirmation email → sign-in → reset in the built app with
   real keys.
3. Open a hostile test page inside a profile window and confirm no
   `window.joe`/`window.joeChrome` binding exists (expected: `undefined`).

## Residual risk statement

The app runs untrusted web content in Electron/Android WebView — the same
engine-level attack surface as any browser (renderer RCE → app process).
Mitigations: sandboxed renderer contexts without Node, no preload on browsed
pages, context isolation everywhere, external navigation from the manager
blocked, single-instance lock, and rapid engine updates through Electron/WebView
releases. Joe Browser does not claim to resist nation-state attackers or
engine-level fingerprinting; see README "Scope, honestly".
