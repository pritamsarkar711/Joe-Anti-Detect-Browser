# Security policy

## Supported versions

| Version | Status |
|---|---|
| 3.2.x | Supported — security fixes land here |
| 3.1.x and earlier | **Not supported.** 3.1.1 and earlier accepted any password on the account screen and granted owner rights to a typed email address; do not deploy them. |

## Reporting a vulnerability

Open a private report through **GitHub → Security → Report a vulnerability** on
this repository. Please do not open a public issue for an unfixed vulnerability,
and do not include real credentials, session tokens or personal data in a report.

Useful in a report:

- the version and platform (Windows / Android / web) and whether the app was a
  packaged build or a dev server;
- the smallest reproduction you can manage;
- what you expected versus what happened;
- whether the issue needs a configured Supabase project.

There is no bug bounty. Reports are acknowledged on a best-effort basis; a fix and
credit are offered for anything that turns out to be a real issue, and the report
is disclosed after a fix ships or after 90 days, whichever comes first.

## In scope

- Authentication and session handling (`src/state/cloud.ts`, the account screens).
- Authorization and data isolation: RLS policies, `my_entitlement()`,
  `is_admin()`, the profile-quota trigger and the workspace bootstrap
  (`supabase/migrations/`).
- The Electron shell: preload bridge surface, IPC handlers, the loopback REST API
  and its token/origin checks, profile partition isolation, extension unpacking.
- The Android shell: the JS bridge, intent extras, per-profile data directories,
  the PostgREST client and the credential it sends.
- Secret handling: anything that would put a service-role key, a private key or a
  password into a client, a log, a screenshot or a commit.
- Packaging integrity: a build that omits a runtime module, ships a debug build as
  a release, or is unsigned where signing is claimed.

## Out of scope

- **Fingerprint evasion efficacy.** The product does not claim to be undetectable;
  a site detecting automation, a datacenter IP, or an engine-level inconsistency
  (TLS, HTTP/2, fonts, GPU) is a documented limitation, not a vulnerability.
- CAPTCHA or bot-detection bypass. The project does not implement or accept these.
- Issues that require an already-compromised device, a modified binary, or
  physical access to an unlocked phone.
- Third-party detector scores, and anything that depends on a service the project
  does not control.
- Supabase's own platform, Electron's Chromium, or Android WebView bugs — report
  those upstream, though a note here is welcome if the configuration makes them
  exploitable.

## Security-relevant facts about this project

- The **publishable (anon) key is public by design** and is not a secret. It grants
  what RLS grants, which is nothing without a user session.
- A **service-role key must never ship in a client**. The Settings field rejects
  one, `tests/schema.test.ts` scans the repository for one, and the local desktop
  API token is separate and per-install.
- **Workspaces are local by default.** Profiles, history and proxies live in
  `localStorage` / `userData` / `SharedPreferences` on the device; only commands,
  presence and (after migration 0002) entitlement metadata use Supabase.
- The **local REST API** binds to `127.0.0.1`, rejects foreign `Origin` headers,
  requires `application/json`, caps bodies at 1 MB and needs a bearer token
  (`<userData>/api-token.txt`, mode 0600).
- **Offline entitlement cache.** A server-confirmed plan is honoured offline for up
  to 7 days; the administrator flag never is. This is a deliberate trade-off, and
  it is not DRM.
- Open risks and their rationale are listed in
  [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) §6 and [`BUG_REPORT.md`](BUG_REPORT.md)
  (OPEN-001 through OPEN-005).

## Before you deploy

1. Apply both migrations in `supabase/migrations/` and confirm RLS is enabled on
   every table (the second migration fails loudly if it is not).
2. Use the **publishable** key in the app; keep the service-role key on a server.
3. Use one Supabase project per tenant until the Realtime channel issue
   (OPEN-001) is closed.
4. Set your own owner account in `public.app_admins`; `OWNER_EMAIL` in
   `packages/core/src/plans.ts` is only the seed value used by the migration.
5. Build release artifacts from a tagged commit through the release workflow so
   the checksums in `SHA256SUMS.txt` correspond to the source you reviewed.
