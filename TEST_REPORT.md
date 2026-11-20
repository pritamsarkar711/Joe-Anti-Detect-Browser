# Test report — Joe Browser 3.2.0

## Release pipeline observed (run 44589773737, tag v3.2.0)

| Job | Result |
|---|---|
| Shared UI + core | success |
| Windows EXE | success — installer + portable uploaded as `desktop-binaries` |
| Android APK | **failure** — `JOE_SIGNING_STORE_B64` unset; the step failed in the same second on the signing guard |
| GitHub Release | skipped (needs both binaries) |

The Windows binaries were produced by CI and were **not installed** here. The
Android APK was **not built**: refusing to publish an unsigned or throw-away-signed
APK is intended behaviour, not a test failure. The Actions log download for this
run returned `EOF` from the results service, so the cause is established from the
step duration (0 s) and the script's first line rather than from log text.

Everything in this file was executed in this session on this machine. The
integration merge that followed the release attempt re-ran every suite; the
numbers below are from that final run, and the live-database evidence comes
from the Supabase connector against the real project.

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
| 2 | `npm test` | **117/117 tests, 12 files** |
| 3 | `npm run build` | **pass** — typecheck + production bundle |
| 4 | `npm run build:core` | **pass** — `apps/desktop/core.cjs` |
| 5 | `npm run build:android-ui` | **pass** — `dist-android/` |
| 6 | `npm run build:assets` | **pass** — 16 profiles, 17 injection scripts, bundled UI |
| 7 | `npm run build:site` | **pass** — `dist-site/` |
| 8 | `npm run test:site` | **15/15** |
| 9 | `npm run test:fingerprint` | **29/29** self-tests; workspace consistency 100%, uniqueness 77%, grade B |
| 10 | `npm run test:java` | **4/4** sources parse (syntax only — no JDK, so no compilation) |
| 11 | `npm run test:icons` | **9/9** (adds the published-mark guard: favicons and README logo must match `Brand.tsx`) |
| 12 | `npm run test:desktop` | **11/11** |
| 13 | `npm run check:bridges` | **7/7** |
| 14 | `npm run test:packaged` | **4/4** |
| 15 | `npm run test:main` | **16/16** (adds keystroke replay dispatch + refusal, sync failure reporting) |
| 16 | `npm run test:ui-desktop` | **5/5** |
| 17 | `npm run test:ui` | **37/37** real-browser checks, no console errors |
| 18 | `npm run test:devices` | **75/75** across Pixel 8, Xiaomi 13, Galaxy S23, OPPO Find X6, Vivo X90 |
| 19 | `npm run screenshots` | **17 app captures + 11 site captures + OG card**, regenerated from the running app |
| 20 | `node scripts/test-boot-retry.mjs` | **pass** — blocking the entry script and then the App chunk both leave a usable retry (3 document requests) |
| 21 | `bash -n scripts/build-apk.sh`; run without signing secrets | **pass** — syntax accepted, and the build refuses to fabricate a keystore (`JOE_SIGNING_STORE_B64: Release signing store required`) |

Suites 17–19 start their own Vite server and shut it down again (new in 3.2.0).

## 2. What the new tests cover

### `tests/cloud.test.ts` — 25 tests (new; entitlement read now targets `public.accounts`)

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
- the entitlement URL (`/rest/v1/accounts?select=…&id=eq.<uid>`) and
  `Authorization: Bearer <user token>` — own row only, plus owner→premium+admin
  mapping and `not_provisioned` when the row or table is missing;
- `not_provisioned` when the migration is missing;
- **fail-closed parsing** (a missing `profile_limit` is 2, not unlimited; an
  unknown plan is `free`; a string `is_admin` is not a boolean);
- session persistence, cache bound to the account email, 7-day expiry,
  corrupted-cache tolerance, and **refusal to restore `is_admin` from storage**.

### `tests/schema.test.ts` — 10 tests (rewritten for the applied schema)

Static invariants over `supabase/migrations/*.sql` and a credential scan:

- RLS enabled on every table the migrations create (public and `joe_private`);
  no `using (true)`, no `with check (true)`, no `to anon`, no `for all to public`;
- every static policy scoped to membership or `auth.uid()`, **including** the
  dynamic `execute format(...)` policy that covers five tables (a regex over plain
  statements would have missed the most important ones);
- `account_allowlist` has no user policy and an explicit revoke; `accounts` has
  no insert/delete policy, own-row select, and the `guard_account_plan` trigger
  freezing plan and limit;
- `handle_new_account`, `require_user`, `require_admin`, `msap_my_entitlement`
  are `SECURITY DEFINER`; `joe_private` grants nothing to the API roles;
- new accounts fail closed to `free` unless the allowlist says otherwise, with
  the backfill reading the allowlist for pre-trigger users;
- the relay table has no anon policy at all;
- migration order is exactly `0001` then `0002_accounts_and_licensing` (a
  competing `0002_entitlements` must never reappear);
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
npm test                      # 117 tests
npm run build
npm run test:ui               # 37 checks, self-serving
npm run test:devices          # 75 checks, self-serving
npm run build:core && npm run build:android-ui && npm run build:assets
npm run build:site && npm run test:site
npm run test:java test:icons test:desktop check:bridges test:packaged test:main test:ui-desktop
npm run screenshots
```
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

## 8. v3.2.1 — the packaged startup regression (2026-11-20)

The owner ran the v3.2.0 installer and the app sat on "Starting Joe Browser…"
forever. That failure mode is now reproduced, fixed and gated.

**Reproduction** (`node scripts/boot-check-web.mjs dist/index.html --expect-fail`
— real headless Chromium over `file://`):

```
requestfailed: file:///assets/style-….css  (net::ERR_FILE_NOT_FOUND)
requestfailed: file:///assets/index-….js   (net::ERR_FILE_NOT_FOUND)
requestfailed: file:///assets/react-….js   (net::ERR_FILE_NOT_FOUND)
state: { bootHidden: false, rootChildren: 0, bodyText: "Starting Joe Browser…" }
```

**Fix verification** (`node scripts/boot-check-web.mjs apps/desktop/web-dist/index.html`):

```
state: { bootHidden: true, rootChildren: 1,
         bodyText: "Profiles Isolated identities … Import New profile …" }
problems: []
```

The harness self-test inverts both directions (`--expect-fail` on the broken
bundle must fail). The new gates and where they run:

| Gate | What it proves | Runs in |
| --- | --- | --- |
| `npm run test:webdist` | built HTML uses relative refs, all assets present | CI `verify`, release `web` job |
| `npm run test:boot-web` | the bundle mounts from `file://` in real Chromium | CI `verify`, release `web` job |
| `check-asar` content check | the *packed* index.html resolves inside the archive | release `desktop` job (on the built EXE's contents) |
| `scripts/boot-check.cjs` | the manager window boots in real Electron | CI `verify` (Linux/xvfb), release `desktop` job (Windows, pre-publish) |

Suite after this work: `npm test` **117/117** (12 files) including the pins
that keep the corrected pipeline in place (tests/v2.test.ts "ships a UI bundle
that loads over file:// instead of the v3.2.0 hang"). `tsc` clean;
`npm run test:webdist` 2/2; `npm run test:boot-web` pass; `npm audit` 0.

## 9. v3.2.2 — Android signing reality and the toolbar boot gate (2026-11-20)

**Android APK: the wall and the way through it.** The release keystore cannot
be delivered to CI from any integration available here (GitHub Actions secrets
return 403 for this token; the key must never be committed or pasted into
chat). Instead of shipping nothing, `scripts/build-apk.sh` now signs with:

1. the owner's release key when the four `JOE_SIGNING_*` secrets exist
   (created on the owner's machine by `scripts/setup-signing.sh`, which uses
   openssl + `gh secret set` — the private key never leaves their machine and
   GitHub's secret store), or
2. a **per-build key** generated inside the CI run (`JOE_SIGNING_ALLOW_EPHEMERAL=1`),
   producing a real, installable APK whose mode and certificate SHA-256
   fingerprint are published in `Android-signing.txt` and mirrored in the
   release notes. The documented consequence: updating between per-build-key
   APKs requires uninstalling first.

`apksigner verify` runs on every APK. Keystores in JKS and PKCS#12 are both
accepted (`--ks-type` detected from the store's magic bytes).

**Windows profile toolbar gate.** `scripts/boot-check.cjs` phase 2 opens
`chrome.html` in real Electron with the real preload, pushes a `nav:state`
exactly as the main process does, and fails unless the tab strip and address
bar render from it. This runs on the Windows release runner before publishing,
alongside the existing manager-window boot.

**Windows first-run honesty**: the EXEs are unsigned (no purchased code-signing
certificate); SmartScreen guidance is now in the README and release notes.

Suite: `npm test` **118/118** (12 files), including three compose-script
signing branches (absent / per-build key / release key) and pins for
`setup-signing.sh`, `build-apk.sh`'s signing modes, and the workflow's
ephemeral opt-in.
