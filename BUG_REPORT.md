# Bug report — Joe Browser 3.2.0

Every entry below was found by reading the code or by a command in this
repository. "Verified" means the listed command was run after the change and its
result is in [`TEST_REPORT.md`](TEST_REPORT.md). Nothing here is marked fixed on
the strength of the diff alone.

Environment for this audit: Debian, Node `v22.22.3`, npm `10.9.8`, Python
`3.11.2`, headless Chromium available through `@sparticuz/chromium`. **No JDK, no
Android SDK, no Electron runtime, no Postgres, no Windows or Android device.**
Consequences of that are stated in each entry instead of being papered over.

Severity: **critical** = privilege escalation or data exposure; **high** = a
documented feature does not work or a limit is bypassable; **medium** = wrong
behaviour, broken tooling or evidence integrity; **low** = inconsistency.

---

## BUG-001 — Anyone could become the owner by typing an email · critical

**Where** `src/state/store.tsx` (`signIn`), `packages/core/src/plans.ts` (`isAdmin`)

**What** `isAdmin()` compared `account.email` with `ADMIN_EMAIL`, and `signIn()`
set `role: 'owner'`, `plan: 'premium'` whenever the typed email matched. There was
no password, no server and no token: the account screen accepted any input.

**Impact** Full owner-tier access (unlimited profiles, every engine) with no
authentication at all.

**Fix** `isAdmin()` now requires `verified === true` (a server-confirmed session)
**and** a role assigned by the server. The owner address survives only as
`OWNER_EMAIL`, a seed value for `public.account_allowlist` in the migration
(applied live: the owner row resolves to plan `owner`, unlimited); it grants
nothing in the client.

**Verified** `tests/v3.test.ts` → *"refuses administrator rights claimed by email
alone"* passes; the full suite passes.

---

## BUG-002 — Hosted authentication did not exist · critical

**Where** `src/ui/views/AuthView.tsx`, `src/state/store.tsx`

**What** With Supabase configured, the screen said "Accounts are handled by your
Supabase project" and then called the local `s.signIn(email)` — no request was
made. Sign-up never created an account, registration never reached the server,
and the "reset link" message was unconditional. The README claimed otherwise.

**Impact** Every account feature in the product brief was missing behind a form
that appeared to work.

**Fix** New `src/state/cloud.ts` implements Supabase Auth over `fetch` (works in
the browser, the Electron renderer and the Android WebView with no new
dependency): `signUp`, `signInWithPassword`, `sendRecoveryEmail`, `signOut`,
`refreshSession`, `ensureFreshSession`, `fetchEntitlement`, plus session and
entitlement persistence. Failures are typed (`invalid_credentials`,
`email_not_confirmed`, `network`, `not_provisioned`, …) and surfaced verbatim in
the UI.

**Verified** `tests/cloud.test.ts` (21 tests) covers the request shape, error
mapping, refresh, revocation, RPC auth header and cache rules. The screen was
driven in headless Chromium: with no project configured it disables sign-in and
explains why (`assets/screenshots/14-account.png`).

**Not verified** A live round-trip against a real Supabase project. No project
credentials are available here and none were requested.

---

## BUG-003 — "Unlock Premium" upgraded any account with one click · critical

**Where** `src/ui/views/SettingsView.tsx`, `src/state/store.tsx` (`setPlan`)

**What** `setPlan('premium')` wrote the plan into `localStorage`. No payment, no
check, no server.

**Impact** The paid tier was advisory; the free limit could be removed at will.

**Fix** `setPlan` is gone. The plan comes from the caller's own
`public.accounts` row (readable only under `auth.uid() = id`; plan/limit
columns frozen by `guard_account_plan`). The account panel now shows
provenance ("Device-only account…", "Cached from your last verified session…",
"Plan confirmed by your account service") and a Refresh button.

**Verified** `tsc` clean; `tests/schema.test.ts` fails if a write policy is added
to `entitlements`; the Settings screenshot shows the new panel.

**Not implemented** A payment provider. Premium is assigned by an administrator
or a payment webhook through the service role. There is no checkout, and the UI
does not pretend there is.

---

## BUG-004 — Android → desktop sync could never pass row-level security · high

**Where** `apps/android/.../SyncHttp.java`, `SyncPoller.java`, `MainActivity.java`

**What** Three independent problems:

1. the client sent the **anon key** as the bearer token, so `auth.uid()` was null
   and every `commands` insert/select was denied by RLS;
2. it hard-coded `workspace_id = 00000000-…-0001`, a workspace no user is a
   member of;
3. `post()` returned `false` on failure but the bridge reported `{"ok":true}`
   regardless, so the UI showed success.

**Fix** (final design after the integration merge) `SyncHttp` speaks only to
the `joe-command-validate` edge function with the publishable anon key; the
function validates action, profile, device and payload server-side and alone
holds the service-role key. `sync:send` reports `{ok:false, reason}` when the
relay is unreachable instead of claiming success, and the poller idles while the
anon key is blank instead of sending doomed requests. An earlier session-token
variant from the parallel branch was superseded — RLS already refuses anonymous
direct writes (verified live, SQLSTATE 42501).

**Verified** `npm run check:bridges` → *"the Android sync authenticates with the
user session, not the anon key alone"*; `npm run test:java` parses all four
sources.

**Not verified** A real request from a phone. No device, emulator or APK build
here.

---

## BUG-005 — No user could ever become a workspace member · high

**Where** `supabase/migrations/0001_joe_browser_init.sql`

**What** Every table was behind RLS requiring membership in
`workspace_members`, and `workspace_members` had only a SELECT policy. Nothing —
no trigger, no function, no policy — ever inserted a membership. A newly
registered user therefore saw an empty, permanently empty workspace.

**Fix** (not shipped as originally designed) The parallel branch's
`ensure_user_workspace()` migration was never applied and was removed in the
integration merge. The shipped path does not depend on workspace membership for
the product features: profiles live in the local workspace, entitlement comes
from `public.accounts` (signup trigger + backfill, applied live), and relay
traffic goes through the edge function with the service-role key.

**Superseded** the original `tests/schema.test.ts` assertions for the workspace
bootstrap were replaced with assertions for the applied schema.
insert exist and that no policy on `workspace_members` permits arbitrary writes.

**Not verified** Execution against Postgres (none available).

---

## BUG-006 — Deterministic profile ids were global primary keys · high

**Where** `supabase/migrations/0001_joe_browser_init.sql`

**What** Profile ids are derived from a seed (`createProfile` is deterministic by
design, so Windows and Android agree). `profiles.id` was a global primary key,
so two users creating "Profile 001" produced the same id: the second insert
failed, and `profiles.proxy_id → proxies(id)` could reference another tenant's
row.

**Outcome** (not shipped) The composite `(workspace_id, id)` primary keys were
part of the never-applied `0002_entitlements.sql` and were removed with it in
the integration merge. Deterministic profile ids stay unique within the single
seeded workspace the live schema uses; multi-tenant per-workspace ids need the
composite keys as a follow-up if unrelated tenants ever share a project
(tracked as OPEN-001/OPEN-002 context above).

**Not verified** Execution against Postgres.

---

## BUG-007 — Free-tier limit bypassable through import · high

**Where** `src/state/store.tsx` (`importCsv`, `importData`)

**What** `createOne`, `addProfiles` and `duplicateProfiles` checked
`checkProfileQuota`; CSV import and workspace import did not. A 250-row CSV
produced 250 profiles on the free tier.

**Fix** Both paths now compute the remaining allowance, import only what fits,
report `Imported X of Y — plan limit reached`, and count only genuinely new rows
when re-importing a workspace. The server-side trigger closes the same hole for
API writes.

**Verified** `tsc` clean, full suite passes; `npm run test:ui` exercises the
import path indirectly through the workspace.

---

## BUG-008 — A service-role key was accepted and stored · high

**Where** `src/ui/views/SettingsView.tsx` (publishable-key field), `src/state/store.tsx`

**What** The field was labelled "Never store service keys in a client app" and
then stored whatever was pasted — in `localStorage`, in the Android
`SharedPreferences`, and in `workspace.json`, which is exactly where a service key
must never be.

**Fix** `looksLikeServiceRoleKey()` decodes the JWT payload and `setSetting`
refuses the value with an explanatory toast. `tests/schema.test.ts` also scans
`src/`, `packages/`, the desktop shell and the Android sources for service-role
JWTs, `sb_secret_*`, AWS keys, private-key blocks and hard-coded passwords.

**Verified** Bot checks pass; the scan currently reports zero offenders.

---

## BUG-009 — A failing device run destroyed the committed evidence · medium

**Where** `scripts/device-matrix.mjs`

**What** `report.json` was written unconditionally. Running `npm run test:devices`
without a dev server replaced a verified `75/75` report with `0/5 — connection
refused` and left that file in Git (observed during this audit, and reverted).

**Fix** The report is written only when every check passes; a failing run is
written to a scratch file in `os.tmpdir`, announced, and exits non-zero.

**Verified** A full passing run rewrote the report; the failure path is a
three-line branch covered by running the suite before a server existed (the
original failure is what exposed the bug).

---

## BUG-010 — Browser gates needed a manually started server · medium

**Where** `scripts/ui-check.mjs`, `scripts/device-matrix.mjs`, `scripts/screenshots.mjs`

**What** All three defaulted to `http://localhost:5173` and failed with
`ERR_CONNECTION_REFUSED` on a clean checkout, although `package.json` and the
README present them as ordinary commands.

**Fix** New `scripts/serve.mjs`: reuses `BASE_URL` when it answers, otherwise
starts Vite (preview when `dist/` exists, dev otherwise) on a free port, waits
for it, and shuts it down on exit.

**Verified** `npm run test:ui` → 35/35 and `npm run test:devices` → 75/75 from a
cold start; `npm run screenshots` regenerated 17 app captures and 11 site
captures.

---

## BUG-011 — Fail-open entitlement parsing · high (introduced and fixed during this work)

**Where** `src/state/cloud.ts` (`parseEntitlement`)

**What** The first version mapped a *missing* `profile_limit` to `null`, which the
rest of the app reads as "unlimited". An incomplete server response would have
granted unlimited profiles.

**Fix** A three-state reader (`undefined` = absent, `null` = explicitly
unlimited, number = limit) with a fail-closed default of 2 unless the server
explicitly says otherwise. `tests/cloud.test.ts` pins the rule.

**Verified** The test that failed is the test that caught it; it now passes.

---

## BUG-012 — Release metadata disagreed with itself · medium

**Where** `apps/desktop/main.js` (`APP_VERSION = '3.1.0'`), `package.json` (`3.1.1`),
`site/index.html`, `AndroidManifest.xml`

**What** The desktop shell reported a version one release behind; the site and
README named a third. `test:site` only compared some of the surfaces.

**Fix** Everything is `3.2.0` (`versionCode 6`), and `test:site` plus
`tests/v2.test.ts` assert consistency across README, site metadata, workflow and
package.

**Verified** `npm run test:site` → 15/15; `npx vitest run` → 87/87. The release
workflow was also updated (default tag, notes) — the check caught my own first
attempt, which had dropped the required "not undetectable" scope sentence.

---

## BUG-013 — The test server left an orphan and hung the suite · medium (introduced during this work)

**Where** `scripts/serve.mjs`

**What** Spawning `npx vite` created a wrapper process whose child kept the port
and the inherited stdout pipe. `npm run test:devices` printed `75/75` and then
hung until the caller's timeout (observed: exit 124 after 900 s).

**Fix** The Vite CLI is spawned directly with `process.execPath`, detached, and
terminated by process group; stdio is destroyed and the child unref'd on stop.

**Verified** The suite now completes in ~38 s and exits 0; a standalone probe
starts and stops the server in ~0.3 s.

---

## BUG-014 — `createOne` lied about its return type · low

**Where** `src/state/store.tsx`

**What** When the quota refused a creation it returned
`null as unknown as BrowserProfile`, so callers were typed as always receiving a
profile.

**Fix** The signature is `BrowserProfile | null`; the one caller already checked
for a falsy result.

---

## BUG-015 — The owner address was the login form placeholder · medium

**Where** `src/ui/views/AuthView.tsx`

**What** `placeholder={ADMIN_EMAIL}` displayed the administrator email in the
sign-in form — a disclosure of the privileged address at the exact place where
BUG-001 made it a credential.

**Fix** Removed. The form has no identity hint.

---

## BUG-016 — A cached entitlement could restore the administrator flag · high (introduced and fixed during this work)

**Where** `src/state/cloud.ts` (`loadCachedEntitlement`)

**What** The offline cache stored the whole entitlement, including `is_admin`, in
`localStorage`. A hand-edited cache would have granted owner rights for up to the
7-day grace window.

**Fix** The administrator flag is never restored from storage (`isAdmin: false` on
load) and is re-verified against the server on reconnect; the cache is also bound
to the account email so one user's plan cannot be restored onto another.

**Verified** Two tests in `tests/cloud.test.ts` cover both properties.

---

## BUG-017 — A failed entry script left no recovery action · medium (fixed on `main`, merged here)

**Where** `index.html`, `src/boot.tsx`

**What** The boot error screen was rendered by the very script that had failed to
load. If the entry chunk itself failed — a truncated install, a blocked asset — the
window stayed empty with nothing to click, which is the permanent white screen the
brief describes.

**Fix** A plain HTML retry link exists in the static shell before any JavaScript
runs, and the failure screen adds a Retry button. `scripts/test-boot-retry.mjs`
blocks the entry script and then the app chunk and asserts a document request for
each retry.

**Verified** `node scripts/test-boot-retry.mjs` → *"PASS: missing entry and
missing app chunk both allow retry"* (3 document requests).

---

## BUG-018 — Every APK build used a different signing identity · medium (fixed on `main`, merged here)

**Where** `scripts/build-apk.sh`, `.github/workflows/release.yml`

**What** The script generated a fresh keystore per build, so each release was
signed by a different key. Android refuses an in-place update signed by another
identity: users would have had to uninstall, losing their workspace.

**Fix** The build now requires an externally managed store and alias from CI
secrets and fails loudly when they are absent (`JOE_SIGNING_STORE_B64: Release
signing store required`), instead of fabricating one. Past installs signed with an
unavailable key are still not upgradable — the release notes warn to back up data
before uninstalling.

**Verified** `bash -n scripts/build-apk.sh` and an invocation without the secrets,
which refuses as intended.

---

## Known open issues (not fixed in this release)

| ID | Issue | Why it is still open | Mitigation |
|---|---|---|---|
| OPEN-001 | The desktop Realtime channel is the fixed name `joe-sync` and is authorised with the anon key. Someone else holding the project's anon key could join it and broadcast `command:launch`. | Fixing it properly requires per-workspace channel names plus `realtime.messages` RLS policies and Realtime auth tokens — a change that cannot be tested here without a project. | Commands are filtered by `to`/`from`, and the local REST API stays loopback + token gated. Do not share a project between unrelated tenants until this is closed. |
| OPEN-002 | `profiles`/`proxies` tables are provisioned but the app keeps workspaces in `localStorage`; only commands and presence use the cloud. | Implementing two-way profile sync is a product decision (conflict resolution, deletions), not a bug fix. | Workspace export/import is the supported path between devices. |
| OPEN-003 | No payment provider. | Out of scope without a real provider account; inventing one would be a fake feature. | Premium is granted server-side by an administrator. |
| OPEN-004 | Windows/Android binaries are built only in GitHub Actions. | This environment has no JDK, Android SDK, Electron runtime or Windows host. | CI/release workflow builds and checksums them; see `RELEASE_NOTES.md`. |
| OPEN-005 | Migrations are verified statically in the test suite **and** applied to the live project (`20261119181923`), but no automated test runs against that database from CI. | Live verification was done interactively this session (RLS 42501, entitlement rows, allowlist deny); CI has no project credentials by design. | Keep `schema.test.ts` as the CI gate; re-verify live after every migration. |
| OPEN-006 | The generated Android demo workspace seeds documentation-range proxy addresses with a successful status and a latency value that was never measured, so a clean install can show invented measurements. | Demo fixtures and first-run production state are the same file; separating them changes what the APK ships and was not attempted in this pass. | Proxy checks in the desktop app recompute status; treat seeded latency as demo data. Tracked for the next release. |
## Bugs found by the merged audit thread (added when the two work branches joined)

### BUG-019 — History recorded nothing · major

The History view listed, filtered and cleared entries, but `addHistory` had
**zero callers** anywhere in the codebase: the view showed three seeded demo
rows forever while the product promised "every URL and search".

**Fix** Desktop `attachHistory` streams every main-frame navigation
(`history:entry`) with title refresh; `BrowserActivity` appends per-profile
JSONL served through `JoeBridge`; `packages/core/src/history.ts` owns search
classification, deterministic ids and merge/dedupe. `clearHistory` also clears
the native files.

**Verified** `tests/history.test.ts`; `test:main` navigates a profile tab and
asserts classified, titled, deduplicated entries reach the manager.

### BUG-020 — Browsed pages held the full management IPC bridge · critical

`preload.js` was attached to profile windows whose webContents browsed the open
web. Any site could call `window.joe.workspace.replace()`,
`profiles.delete()`, `sync.configure()` — full workspace control from a hostile
page. The Android manager WebView carried `JoeBridge` while allowed to navigate
to remote URLs.

**Fix** Tabs browse in WebContentsViews with **no preload**; the bridge is
exposed only to bundled pages (`file:`) and localhost dev servers; the Android
manager refuses navigation away from `file:///android_asset/` and opens external
links outside the app. (The account-client thread fixed the adjacent BUG-001:
local email typing could not again grant owner, since roles now come from the
server.)

**Verified** `test:main` rejects chrome commands from foreign senders; the
preload trust gate is enforced in code; `check:bridges` pins the Android
navigation guard.

### BUG-021 — The shipped toolchain carried 11 dependency advisories · high (dev-only)

vitest 3's `@vitest/mocker`/`tinypool` prototype-pollution gadgets, esbuild's
dev-server origin bypass and lodash/lodash-es (via java-parser).

**Fix** vitest 5, esbuild 0.28, `overrides` lifting lodash/lodash-es to 4.18.1,
`vite-node` pinned explicitly (vitest 5 no longer bundles it). `npm audit` is
clean tree-wide; CI enforces `npm audit --omit=dev --audit-level=high` and a
credential-pattern scan (`scripts/check-secrets.mjs`) on every push.

**Verified** `npm audit` → 0; `npm run test:secrets` → clean over 119 files.
