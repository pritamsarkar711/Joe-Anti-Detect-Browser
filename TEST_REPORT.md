# Test report — Joe Browser 3.2.0

Everything in this file was executed in this session on this machine.

**Environment.** Debian (container), Node `v22.22.3`, npm `10.9.8`, Python
`3.11.2`, headless Chromium via `@sparticuz/chromium`. **No JDK, no Android SDK,
no Gradle, no Electron runtime, no Postgres, no display server, no Windows host,
no physical or emulated Android device.**

That environment explains every "not run" below; none of them was skipped to make
a result look better.

---

## 1. Result matrix

| # | Command | Result |
|---|---|---|
| 1 | `npx tsc --noEmit` | **pass** (exit 0) |
| 2 | `npm test` | **102/102 tests, 11 files** |
| 3 | `npm run build` | **pass** — typecheck + production bundle |
| 4 | `npm run build:core` | **pass** — `apps/desktop/core.cjs` |
| 5 | `npm run build:android-ui` | **pass** — `dist-android/` |
| 6 | `npm run build:assets` | **pass** — 16 profiles, 17 injection scripts, bundled UI |
| 7 | `npm run build:site` | **pass** — `dist-site/` |
| 8 | `npm run test:site` | **15/15** |
| 9 | `npm run test:fingerprint` | **29/29** self-tests; workspace consistency 100%, uniqueness 77%, grade B |
| 10 | `npm run test:java` | **4/4** sources parse (syntax only — no JDK, so no compilation) |
| 11 | `npm run test:icons` | **8/8** |
| 12 | `npm run test:desktop` | **11/11** |
| 13 | `npm run check:bridges` | **7/7** |
| 14 | `npm run test:packaged` | **4/4** |
| 15 | `npm run test:main` | **15/15** |
| 16 | `npm run test:ui-desktop` | **5/5** |
| 17 | `npm run test:ui` | **37/37** real-browser checks, no console errors |
| 18 | `npm run test:devices` | **75/75** across Pixel 8, Xiaomi 13, Galaxy S23, OPPO Find X6, Vivo X90 |
| 19 | `npm run screenshots` | **17 app captures + 11 site captures + OG card**, regenerated from the running app |
| 20 | `node scripts/test-boot-retry.mjs` | **pass** — blocking the entry script and then the App chunk both leave a usable retry (3 document requests) |
| 21 | `bash -n scripts/build-apk.sh`; run without signing secrets | **pass** — syntax accepted, and the build refuses to fabricate a keystore (`JOE_SIGNING_STORE_B64: Release signing store required`) |
| 22 | `npm run test:secrets` | **3/3** — 7 credential-pattern families over 119 files, no env files, no tracked key material |
| 23 | `npm audit` | **0 vulnerabilities** tree-wide (vitest 5, esbuild 0.28, lodash 4.18 overrides) |

Suites 17–19 start their own Vite server and shut it down again (new in 3.2.0).

## 2. What the new tests cover

### `tests/cloud.test.ts` — 21 tests (new)

The Supabase account client, with `fetch` mocked:

- the exact auth URL, `apikey` header and JSON body for password login;
- rejection of a wrong password (`invalid_credentials`) — never a silent pass;
- a distinct `email_not_confirmed` result;
- a network failure surfacing as `network`, never as success;
- sign-up requiring email confirmation;
- password recovery refusing to claim a mail was sent when nothing is configured;
- sign-out surviving an offline network;
- refresh-token rotation, identity preservation when the response omits the user,
  and revocation returning `null`;
- refresh only inside the expiry margin;
- the entitlement RPC URL and `Authorization: Bearer <user token>`;
- `not_provisioned` when the migration is missing;
- **fail-closed parsing** (a missing `profile_limit` is 2, not unlimited; an
  unknown plan is `free`; a string `is_admin` is not a boolean);
- session persistence, cache bound to the account email, 7-day expiry,
  corrupted-cache tolerance, and **refusal to restore `is_admin` from storage**.

### `tests/schema.test.ts` — 12 tests (new)

Static invariants over `supabase/migrations/*.sql` and a credential scan:

- RLS enabled on all nine tables; no `using (true)`, no `with check (true)`, no
  `to anon`, no `for all to public`;
- every static policy scoped to membership or `auth.uid()`, **including** the
  dynamic `execute format(...)` policy that covers five tables (a regex over plain
  statements would have missed the most important ones);
- `entitlements` and `app_admins` have no user write policy;
- `my_entitlement`, `is_admin`, `enforce_profile_quota`, `ensure_user_workspace`,
  `my_workspace_id` are `SECURITY DEFINER` with `revoke all … from public` and a
  scoped `grant execute`;
- anonymous callers fail closed;
- the quota trigger is `before insert` and skips only the service role;
- the auth-user bootstrap trigger and owner membership insert exist;
- composite `(workspace_id, id)` primary keys and the composite proxy foreign key;
- repository secret scan: no service-role JWT, `sb_secret_*`, AWS key, private-key
  block or hard-coded password in `src/`, `packages/`, `apps/desktop`,
  `apps/android/app/src` (0 offenders).

### `tests/v3.test.ts` — 9 tests (3 added)

Plan/quota rules plus two regression tests: **administrator rights cannot be
claimed by email alone**, and **no browser identity is offered that the bundled
engine cannot back** (four Chromium identities; Firefox unavailable and absent
from every plan).

### `scripts/ui-check.mjs` — 37 real-browser checks (2 rewritten)

Now asserts the security properties end to end in a real browser:

- writing `plan: 'premium', role: 'owner'` into `localStorage` and reloading
  leaves the account on **`Free plan · 2 profiles`** — the forged claim is ignored;
- a seventh profile on the demo tier is **refused** and the dialog stays open with
  a reason, instead of silently creating it;
- the create dialog offers exactly four Chromium identities and states that
  Firefox is unavailable;
- a 250-profile fixture renders 250 in the metric strip while the table renders 20
  rows per page.

The previous version of this suite *used* the bypass (it wrote a premium plan into
`localStorage` to unlock bulk creation); that is why it had to be rewritten, not
merely adjusted.

## 3. Failure modes proven, not assumed

| Guard | How it was shown to fail when broken |
|---|---|
| `parseEntitlement` fail-closed | The first implementation treated a missing limit as "unlimited"; the new test failed and the code was fixed. |
| Version consistency (`test:site`, `tests/v2.test.ts`) | Failed twice during this session: once because `site/index.html` and the README still said 3.1, once because the rewritten release notes dropped the required "not undetectable" scope sentence. Both were corrected. |
| Device-report integrity | Observed in the baseline: running without a server replaced a 75/75 report with 0/5. The report is now only written on a clean run. |
| Server lifecycle | The first `serve.mjs` used `npx`, which left a grandchild holding the pipe: `test:devices` printed 75/75 then hung until a 900 s timeout (exit 124). Fixed by spawning Vite directly, detached, and exiting in ~38 s. |
| UI plan forging | `test:ui` failed immediately after the entitlement fix, because the suite depended on the vulnerability. The suite was corrected to assert the fix. |

## 4. Not run here, and why

| Not run | Reason | What exists instead |
|---|---|---|
| Applying `0001`/`0002` to Postgres | No database server and no project credentials; none were requested | Static invariant suite (12 tests) + a CI step that rejects a permissive policy or a missing function |
| Live sign-up → login → entitlement round-trip | Same | 21 mocked-fetch tests covering the protocol shape and every failure branch |
| Building the NSIS/portable EXE | No Electron runtime, no Windows host | `test:packaged` stages `build.files` and boots the main process against a functional stand-in; `check-asar.mjs` inspects a real archive header in the release workflow |
| Building the APK | No JDK, no Android SDK, no build-tools | `test:java` parses all four sources and rejects the lambda/desugaring pattern that broke the 3.1.0 build; the APK is produced by `release.yml` |
| Installing and running on Windows/Android | No device or VM | Documented as unverified in `PROJECT_AUDIT.md` §5 |
| CPU/RAM profiling on Windows | Same | Code-level measures only (see `REQUIREMENTS_TRACKER.md` phase 14) |
| Landscape / keyboard-inset mobile testing | Device matrix is portrait-only today | Recorded as a gap in the tracker |
| Third-party detector scores (BrowserScan, Pixelscan, AmIUnique, BrowserLeaks) | Not reachable from this sandbox, and a score would be a claim about the engine, not this code | The app links to them for the user to run inside a launched profile; no score is claimed anywhere |
| `npm audit` advisory report | Registry advisory endpoint not reachable in a usable way here | `npm ci` from the lockfile; a CI step is recommended in `SECURITY_AUDIT.md` §7 |

## 5. Final acceptance checklist (evidence-based)

| Item | Status |
|---|---|
| Desktop application installs / launches | **Not verified** — no Windows host or Electron runtime |
| No permanent white screen | **Implemented** (boot error page, boundary, renderer reload) and exercised in a browser; native runtime unverified |
| No startup crash | `test:packaged` + `test:main` pass; native unverified |
| Android APK installs / launches / icon | **Not verified** — no SDK or device; icon and splash are asserted statically by `test:icons` (8/8) |
| Consistent branding | **Verified** — `test:icons` 8/8, screenshots regenerated |
| Browser engine initialises | `test:main` exercises launch paths against a stand-in; native unverified |
| Profiles create/edit/delete; data isolated | Create/edit/delete verified in the UI suite; partition isolation reviewed in code, not runtime-tested |
| History works | **Verified** in the UI suite |
| Proxy management works | Assignment/CRUD verified in the UI suite; health values are modelled, not measured |
| Extension management works | Desktop-only code path, packaging verified; native runtime unverified |
| Authentication / password recovery | **Implemented and unit-tested**; live round-trip unverified |
| Supabase permissions secure | **Verified statically** (12 tests); not executed against Postgres |
| Free/premium/admin permissions | **Verified** in unit + browser tests, including the forged-claim regression |
| Critical vulnerabilities resolved | 14 of 16 findings fixed and regression-tested; 2 accepted with written rationale |
| No major UI overflow | **Verified** — 0 px overflow on desktop and five phone viewports |
| Performance acceptable | **Not measured** on Windows |
| Automated tests pass | **Verified** — matrix above |
| GitHub Actions checks pass | **Not verified** — workflows edited, not executed here |
| Release artifacts valid | **Not verified** — built by CI from a tag, not in this session |
| Documentation updated | **Verified** — README, CHANGELOG, SECURITY, audit set, screenshots |
| Screenshots represent the app | **Verified** — regenerated from the running build |
| Release notes accurate | **Verified** — rewritten and gate-checked |

## 6. Reproduce

```bash
npm ci
npx tsc --noEmit
npm test                      # 102 tests
npm run build
npm run test:ui               # 37 checks, self-serving
npm run test:devices          # 75 checks, self-serving
npm run build:core && npm run build:android-ui && npm run build:assets
npm run build:site && npm run test:site
npm run test:java test:icons test:desktop check:bridges test:packaged test:main test:ui-desktop
npm run screenshots
```

---

## 7. Merged audit thread — additional suites and evidence

The second work branch added these suites; all run in the same environment
(Debian, Node 22, no display server, no JDK/Android SDK/Electron).

| Suite | Result | What it proves |
|---|---|---|
| `tests/history.test.ts` | 5 tests | search detection on six engines, classification, deterministic ids, merge dedupe/order/cap, Android import shape |
| `tests/version.test.ts` | 6 tests | desktop package == root package; `main.js` derives `APP_VERSION` from package.json; the store constant, Android manifest `versionName`/`versionCode`, manager UA and the site build all agree; hard-coded literals are rejected |
| `npm run test:secrets` | 3 checks | 7 credential-pattern families over the whole tree, no env files, no tracked key material |
| `test:main` chrome routing | 15 checks total | toolbar commands (tabs new/select/close, navigation with bare-host/search fallback, find, zoom, bookmarks, deny-by-default permissions, clear-data) reach the real handlers; foreign senders are rejected; unknown actions fail loudly |
| `test:desktop` | 11 checks | adds chrome.html to the packaging allowlist gate; preload↔main channel parity (29 channels) |
| `check:bridges` | 8 checks | adds the Android browser-controls needles (11 controls) and keeps the session-token handoff check |

### Proven failure modes from this thread (same "revert the fix" method)

| Gate | Reverted-fix result |
|---|---|
| `test:main` history check | `0 history entries` when `attachHistory` is removed |
| `test:main` chrome checks | `No profile window owns this toolbar` when the sender map is dropped |
| `test:secrets` | fails on a planted `AKIA…` key string |
| `tests/version.test.ts` | fails when `main.js` returns to a hard-coded version |
| `test:desktop` | fails when `chrome.html` is removed from `build.files` |

### Environment limits restated

No Windows host (installer/first-launch = release build + packaging gates), no
live Supabase (migration = static verification; live probes listed in
`SECURITY_AUDIT.md`), no physical Android (emulator captures only), no
third-party detector hosts (no scores claimed).
