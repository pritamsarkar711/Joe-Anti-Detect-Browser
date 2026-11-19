# Security audit · 2026-11-19 (second checkpoint) — not clearance to release

## 1. Dependency audit — resolved

Root lockfile `npm audit` reported 11 affected package entries: 2 critical,
7 high, 2 moderate (vitest/tinypool, esbuild, lodash via java-parser) —
tooling and transitive entries, not eleven proven runtime vulnerabilities.
Resolved this checkpoint: vitest 5.1.1, esbuild 0.28.3, vite 6.4.6,
vite-node 6, and pinned patched `lodash`/`lodash-es` ^4.18.1 overrides.
`java-parser` keeps its pinned chevrotain 11.0.3 (chevrotain 13 breaks its
API; its lodash-es exposure is cleared by the override). Both
`npm audit --omit=dev` and full `npm audit` now report **0**. All suites
were re-run green after the upgrade. Independently audit packaged
Electron/Chromium and Android WebView support on release. The nested
desktop manifest is outside the root lockfile.

## 2. Cloud auth and the control plane

- The service-role key exists only as the Supabase project secret
  `JOE_SERVICE_ROLE_KEY`, read by the `joe-command-validate` edge function
  at runtime. It is not in any repository, workflow, client bundle or log.
  Shipped apps carry the publishable anon key only.
- Clients keep **no write path** to `commands`/`command_results`: row-level
  security denies `anon` (verified live: SQLSTATE 42501 on INSERT), and the
  edge function is the only door, validating action, profile, device,
  payload size and shape before it uses the service-role key.
- `public.accounts` rows are backfilled by migration `0002`; the
  `guard_account_plan` BEFORE UPDATE trigger blocks any client-side plan or
  limit escalation; the owner allowlist row yields `plan=owner,
  unlimited=true`. `joe_private` holds the allowlist and licensing tables
  with **no API-role grants** at all.
- Auth configuration (verified live): email/password sign-up enabled, email
  confirmation required, redirect allow-list limited to
  `https://joe-browser-control.vercel.app` — no localhost, no wildcards.
  Confirmation/reset links previously pointed at `http://localhost:3000`
  (fixed).
- Residual drift to watch: the API call that set the canonical site URL also
  nulled unspecified nullable auth-config fields (email rate limit counters,
  captcha/sms providers, session timeouts) because the tool applies a full
  patch. Defaults remain safe (rate limiting is Postgres/GoTrue default,
  captcha off is the shipped posture); re-enable in the dashboard if the
  deployment requires it.

## 3. What this is not

- Removed shell tracing and automatic posting of Android signing logs to
  public issues. Startup import failures emit a fixed event rather than
  exception contents. This is not a full log/secret scan.
- No CAPTCHA bypass, no identity spoofing, no claim of undetectability.
  Human-paced typing is accessibility text entry only.
- RLS, native navigation/IPC sender checks, Android bridge origin
  restrictions and subscription enforcement have been verified where noted
  above, but independent re-verification before publication is still due.
- The edge function has not been invoked end to end from a real device in
  this session (sandbox cannot reach supabase.co); its handler is
  unit-tested and the deployment is ACTIVE.

## 4. Signing state (honest)

- **Windows:** `release.yml` produces installer and portable EXE with
  `SHA256SUMS.txt`; there is **no code-signing step** — the binaries are
  unsigned. A purchased certificate must be wired in before telling users
  the download is trusted.
- **Android:** the release APK is signed with the externally managed
  keystore (`JOE_SIGNING_STORE_B64`, alias and store password as secrets);
  past installations signed with unavailable keys may not be upgradable —
  never advise uninstall without warning about data loss.
- A stable signing identity is required for every future release; the
  workflow refuses to invent one.
