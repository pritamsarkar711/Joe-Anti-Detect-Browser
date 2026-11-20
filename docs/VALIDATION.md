# Validation report — v3.2.1

Every number below comes from a command in this repository. Nothing here is a third-party detector score, and no result is claimed for surfaces the project does not control.

Environment: Debian, Node `v22.22.3`, npm `10.9.8`, Python `3.11.2`, no display server, no JDK/Android SDK, no Electron runtime. Native EXE/APK binaries are therefore built only in GitHub Actions.

## Automated suites

| Command | Result |
|---|---|
| `npx tsc --noEmit` | pass, exit 0 |
| `npm test` | 12 files, 117 tests passed (account client, schema invariants, edge-relay unit tests, history, version consistency, core⇄database policy pins) |
| `npm run test:secrets` | clean (7 credential-pattern families, env files, key material) |
| `npm run test:fingerprint` | 29/29 injection self-tests, exit 0 |
| `npm run test:ui` | 37/37 real-browser checks, self-served |
| `npm run test:devices` | 75/75 checks on five Android families, self-served |
| `npm run test:java` | 4/4 Java sources parse cleanly and contain no lambda or method reference (parse only, not compilation) |
| `npm run test:site` | 15/15 static site, version and provenance checks |
| `npm run test:icons` | 9/9 brand-asset checks (launch icon contrast, tile colour, canonical J path, published favicons/logo match Brand.tsx) |
| `npm run test:desktop` | 11/11 desktop packaging checks (allowlist covers every runtime require including chrome.html; IPC channels match) |
| `npm run check:bridges` | 7/7 native-bridge checks (Java methods, intent extras, browser controls, edge-relay credential, generated assets) |
| `npm run test:packaged` | 4/4 packaged-app checks (stages `build.files`, boots the main process) |
| `npm run test:main` | 16/16 main-process checks against a functional Electron stand-in (profile launch with chrome shell and history streaming, toolbar routing, keystroke replay, sync-failure reporting) |
| `npm run test:ui-desktop` | 5/5 renderer checks against a stand-in preload bridge, over `http:` and `file:` |
| `npm run build` | typecheck + production bundle |
| `npm run build:core` | `apps/desktop/core.cjs`, 58 exports |
| `npm run build:android-ui` | Android web bundle (`dist-android/`) |
| `npm run build:desktop` | Desktop web bundle (`apps/desktop/web-dist/`) |
| `npm run build:assets` | 16 profiles, 17 self-testing injection scripts, bundled UI |
| `npm run build:site` | `dist-site/` generated for the canonical URL |
| `npm run build:brands` | 33 official brand marks, Joe Browser mark, 12 flags |
| `npm run screenshots` | 17 app captures + 11 cropped site captures + OG card |

### The 3.1.0 launch failure

The 3.1.0 installer could not start. Windows showed:

```text
Uncaught Exception:
Error: Cannot find module './extensions.cjs'
```

`apps/desktop/main.js` requires `./extensions.cjs` at module scope, but the
electron-builder `files` allowlist in `apps/desktop/package.json` did not list it,
so the module was absent from `app.asar`. Electron threw before creating a
window.

Why nothing caught it: every suite ran against the source tree, where the file
obviously exists. There was no check of the *packaging* configuration and no step
that opened the built artifact. The release job verified the inputs
(`core.cjs`, `web-dist/index.html`) and then trusted electron-builder.

**Root cause, fixed at the source.** `extensions.cjs` is in the allowlist.

**Defence in depth.** The `require` is now wrapped: a missing module disables
extension management with a readable message instead of aborting startup.

**Gates, each verified to fail when its fix is reverted.**

| Gate | What it proves | Reverted-fix result |
|---|---|---|
| `test:desktop` | every relative `require()` is matched by `build.files`; every npm package required at runtime is a real dependency; preload and `ipcMain` expose the same 25 channels | `required by main.js but absent from the packaged app: ./extensions.cjs` |
| `test:packaged` | copies the app using `build.files` and boots it under a stubbed Electron | `the packaged main process loads… — Cannot find module './extensions.cjs'` |
| `test:main` | real `main.js` against a functional Electron stand-in: startup, profile CRUD, launch, proxy, REST API | `workspace:replace is not registered` |
| `test:ui-desktop` | the built renderer, served over HTTP against a stand-in preload bridge | launch never crosses the bridge |
| release job | lists the built `app.asar` and asserts the six runtime entries are inside | `MISSING FROM PACKAGE: extensions.cjs` |

### What 3.1.0 got wrong beyond the crash

An audit of the same class of defect — *code that only looks finished* — found
three more:

1. **Profile launch never worked on the desktop build.** The React UI persisted
   profiles to `localStorage`; the main process kept its own list in `userData`
   and only adopted the Android asset bundle. `profiles:launch(id)` therefore
   arrived with an id the shell had never seen, threw `Unknown profile` inside a
   floating promise (so nothing surfaced), and the row still flipped to
   "running". Fixed with `workspace:replace` / `workspace:read`: the UI mirrors
   its workspace on every mutation, and the shell pushes live status back.
   `nativeLaunch` now awaits the bridge and returns the reason on failure.
2. **Supabase credentials from Settings never reached the phone.** The UI kept
   them in `localStorage`; `SyncPoller` reads `SharedPreferences`. Sync could not
   start no matter what was typed. `pushSyncConfig` writes through
   `JoeBridge.saveConfig`, saving a key now starts the poller immediately, and a
   blank key no longer sends an unauthorised request every five seconds. The
   desktop shell gained `sync:configure` for the same reason — it previously read
   the credentials from the environment only.
3. **The Android launcher icon was invisible.** The adaptive-icon background was
   `#FFFFFF` and the glyph is `#FFFFFF`. With `minSdk 28`, only the adaptive icon
   is ever drawn, so the app appeared to have no icon. The tile is now `#D81B60`,
   `monochrome` is declared for themed icons, and the legacy layer-list (also
   white-on-white) is replaced by `ic_mark.xml`, which the splash now draws
   instead of a bare coloured square.

Two bridge methods that nothing called (`isAndroid`, `toast`) were removed rather
than left as dead API.

### Bundle weight

The app chunk was 712 kB before v3 and is 248 kB now. Two generated data tables
(54 inline flags, 29 observed device samples) moved into their own chunks, so a
cold start parses the shell first:

| Chunk | Size |
|---|---|
| `App` | 248.00 kB |
| `mui` | 325.44 kB |
| `react` | 143.87 kB |
| `flags` | 305.69 kB |
| `icons` | 32.75 kB |

### Workspace quality

`npm run test:fingerprint` reports:

```text
29/29 injection self-tests passed
Workspace: consistency 100%, uniqueness 77%, grade B, distinct bundles 29
Geo match BD: PASS · Unique observed bundles: 29/29
```

- **Consistency 100%** means every generated profile agrees with itself across UA, Client Hints, platform, GPU, screen, DPR, CPU, RAM, fonts, timezone, locale and touch.
- **Uniqueness 77%** is a collision measure inside the workspace, not a cloaking promise.
- **Grade B** is the project's own scale, deliberately not an A while engine-level surfaces are unaddressed.
- Apple/WebKit classes (`iphone-15-pro`, `ipad-pro-11`) are marked `source: 'curated'` because no observed sample exists for them; every other class is `source: 'observed'` and traceable to a `real-*` sample.

### Browser smoke (`npm run test:ui`)

Highlights from the 34 passing checks:

- Six seeded profiles render on first paint; every sidebar destination resolves (16 navigation entries).
- IBM Plex Sans is the active computed font; `no gradients or dashed borders`.
- Command palette opens with Ctrl/⌘ + K and filters.
- Four browser identities are offered (Joe Browser, Chrome, Edge, Brave) on the one bundled Chromium engine; Firefox is listed as unavailable because no Gecko engine is bundled.
- A new profile persists to the table, 250 profiles can be created on Premium, and the table paginates.
- The local JavaScript probe passes `22 of 22 checks`; six independent detector links are present.
- Dark and light themes both render; a desktop-to-Android command is created.
- Proxy add flow works; official marks and circular flags load from local data URIs.
- `no horizontal page overflow · 0px`; no console errors.

### Device matrix (`npm run test:devices`)

`75/75` checks across Google Pixel 8, Xiaomi 13, Samsung Galaxy S23, OPPO Find X6 and Vivo X90. Each device is checked for horizontal overflow, controls outside the viewport, clipped text, overlapping tap targets, bottom navigation (four destinations plus a working **More** drawer), dialog fit, table scrolling and console errors. Report: [`assets/screenshots/devices/report.json`](../assets/screenshots/devices/report.json).

## Extension installation

Extensions are installed by the app itself, into the app's own folder
(`userData/extensions`), not borrowed from the machine's browser profiles. The
installer in `apps/desktop/extensions.cjs` is covered by 8 tests built on real
zip archives generated in the test:

| Case | Expected | Verified |
|---|---|---|
| Valid package | unpacks, manifest read, name and version reported | yes |
| Package wrapped in one folder | inner folder detected | yes |
| No `manifest.json` | rejected, nothing left on disk | yes |
| Not a zip | rejected, nothing left on disk | yes |
| Missing file | rejected, no directory created | yes |
| Entry escaping the directory (`../../x`) | refused as an unsafe path, nothing written outside | yes |
| Listing | only directories with a readable manifest are offered | yes |
| Digest | SHA-256 is stable for the same package | yes |

`tar -xf` was the first implementation and was abandoned: it reads zip with
bsdtar (Windows, macOS) but not with GNU tar, which made installation silently
platform-dependent. The committed reader parses the central directory and
inflates with Node's own zlib, so behaviour is identical on every host and there
is no native dependency in the installer.

**Not claimed:** the app does not silently install from a store URL. Store
packages are signed for the store's own update channel and loading an arbitrary
CRX at runtime needs engine flags that would break the "bundled engine, nothing
borrowed" rule and are a code-execution hazard. The store link stays visible as
an explicit fallback, and the button says `Get` rather than `Install` when there
is no filesystem to install into (web preview, Android).

## Visual verification

Screenshots in `assets/screenshots/` are captured from the running app by Playwright with a real Chromium build; the site uses the cropped, chrome-free versions in `site/screens/`.

Defects found by looking at the captures rather than by assertion, and fixed:

- Two "New profile" buttons on desktop (app bar + page header). The header now only shows the primary action on phones, where the app bar hides it.
- The device picker in the create dialog clipped cards mid-row inside a nested scroller. It is now one row of OS chips over a short card list.
- The Settings select for the default device drew an inline brand icon over its own value.
- "18 contradictions" on a workspace with none: informational engine limits were summed as problems and pushed the grade to B next to a 100 ring. Informational limits are now counted separately and the ring shows the same score the grade derives from.
- An observed device reporting 12 cores with 8 GB of RAM: CPU and RAM were drawn from independent lists. Hardware is now an ordered pair.
- Mobile toolbars wrapped two export icons onto their own row.

## Detector sites

The app links to BrowserScan, Pixelscan, IP Fighter, whoer.net, AmIUnique, CreepJS and BrowserLeaks and provides an in-app probe so a profile can be inspected without leaving the workspace.

Direct Chromium navigation from this sandbox to those hosts fails (`net::ERR_CONNECTION_CLOSED` / blocked egress). Therefore **no third-party detector score is claimed for v3.** The in-app probe result (`22 of 22`) is a local self-test of Joe Browser's own payload, not an independent verdict. To evaluate independently, launch a native profile, open the detector links, and compare proxy exit country, timezone, locale, WebRTC candidates and Client Hints.

Two engine-level corrections were made so a profile does not carry a one-line giveaway:

- WebKit profiles (iPhone/iPad) no longer expose `navigator.userAgentData` and no longer send `Sec-CH-UA*` request headers; Chromium profiles keep both.
- Firefox profiles remove `Sec-CH-UA*` as well.

Verified in a real Chromium context: the iPhone payload reports `navigator.userAgentData === undefined`, the Windows payload reports the expected brand list.

## Stability work in this release

- **White screen on the installed Windows build:** the bundle used absolute asset paths, which fail under `file://`. `base` is now relative for the desktop and Android targets; the built `apps/desktop/web-dist/index.html` was rendered from `file://` with zero console errors.
- **Workspace never persisted:** the first save was skipped, so a fresh install kept nothing and a reload re-seeded the workspace. Saves now run on the first render, under a new `joe-browser:v3` key, with the v2 key read once as a migration source.
- **Dead-end create flow:** the demo workspace held 24 profiles against a 2-profile free tier, so every create attempt was refused. The demo is now six profiles on a six-profile demo allowance; signing in switches to the real two-profile free tier or Premium.
- **Build scripts could not run in CI:** `cross-env` was used by `build:desktop` and `build:android-ui` but never depended on. A dependency-free runner replaces it.
- **Android blank frames:** challenge iframes are child frames that `evaluateJavascript` on the main frame cannot reach, so the payload could disappear. The profile browser now re-injects per frame with three bounded retries and shows an offline error page instead of white.

## What is not claimed

- Not "100% undetectable", not "passes Pixelscan/BrowserScan/CreepJS" and not "AdsPower-tier".
- No claim of parity with C++-patched browsers such as ShardBrowser, Camoufox, Donut/Wayfern or OVO.
- No claim that TLS/JA4, HTTP/2, QUIC, font rasterisation, GPU driver output or CDP side channels are spoofed.
- No claim that the Android APK is production-signed; CI builds are debug-signed and published with checksums.


---

## v3.2.0 — what changed in this report

The detailed evidence for this release lives in [`TEST_REPORT.md`](../TEST_REPORT.md),
the defects in [`BUG_REPORT.md`](../BUG_REPORT.md) and the security review in
[`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md). Two environment limits matter when
reading them:

- **Database.** Migration `0002_accounts_and_licensing` **was executed against
  the live Supabase project** (version `20261119181923`) and its key properties
  verified there interactively (backfilled entitlement rows, deny-all allowlist,
  anonymous writes refused with SQLSTATE 42501). CI still checks the SQL only
  statically (`tests/schema.test.ts`); no sign-up round-trip was run from this
  sandbox (no egress to supabase.co).
- **No native toolchain.** The Windows EXE and the Android APK are produced by
  GitHub Actions. This environment has no JDK, Android SDK, Electron runtime or
  Windows host, so no binary was built or installed here. `test:packaged`,
  `test:main` and `test:ui-desktop` exercise the packaged module graph and the
  renderer against stand-ins, not a running Electron process.

The browser suites (`test:ui`, `test:devices`, `screenshots`) now start and stop
their own Vite server; previously they required a manually started dev server and
the device suite overwrote its committed report when that server was missing.

## v3.2.1 — what changed in this report

v3.2.0's packaged EXE never left its boot splash (the pipeline shipped the web
bundle inside the desktop app). v3.2.1 fixes that and adds the evidence above:

```
npm run build:desktop && npm run build:android-ui && npm run build:core && npm run build:assets
npm run test:webdist      # built HTML: relative refs, all assets present (2/2)
npm run test:boot-web     # mounts from file:// in real Chromium (booted: true)
node scripts/check-asar.mjs <resources-dir>   # packed UI resolves inside the archive
```

The release workflow runs `scripts/boot-check.cjs` in real Electron on the
Windows runner and refuses to publish unless the manager window boots the
bundled UI. `npm test` is 117/117 (12 files). The v3.2.0 EXEs are known-broken
and the release notes say so.
