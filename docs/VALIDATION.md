# Validation report — v2.0.0

Every number below comes from a command in this repository. Nothing here is a third-party detector score, and no result is claimed for surfaces the project does not control.

Environment: Debian 12, Node `v22.22.3`, npm `10.9.8`, Python `3.11.2`, no display server, no JDK/Android SDK, no Electron runtime. Native EXE/APK binaries are therefore built only in GitHub Actions.

## Automated suites

| Command | Result |
|---|---|
| `npx tsc --noEmit` | pass, exit 0 |
| `npm test` | 4 files, 29 tests passed |
| `npm run test:fingerprint` | 29/29 injection self-tests, exit 0 |
| `npm run test:ui` | 31/31 real-browser checks, no console errors |
| `npm run test:devices` | 75/75 checks on five mobile devices |
| `npm run test:java` | 4/4 Java sources parsed cleanly (parse only, not compilation) |
| `npm run test:site` | static site metadata, asset and provenance checks |
| `npm run build` | typecheck + production bundle, 11,544 modules |
| `npm run build:core` | `apps/desktop/core.cjs`, 42 exports |
| `npm run build:assets` | 16 profiles, 17 self-testing injection scripts, bundled UI |
| `npm run build:site` | `dist-site/` generated for the canonical URL |
| `npm run build:brands` | 26 official brand marks, Joe Browser mark, 12 flags |
| `npm run screenshots` | 13 desktop PNGs at 1440×900 |

### Workspace quality

`npm run test:fingerprint` reports:

```text
29/29 injection self-tests passed
Workspace: consistency 100%, uniqueness 77%, grade B, distinct bundles 29
Geo match BD: PASS · Unique observed bundles: 29/29
```

- **Consistency 100%** means every generated profile agrees with itself across UA, Client Hints, platform, GPU, screen, DPR, CPU, RAM, fonts, timezone, locale and touch.
- **Uniqueness 77%** means 29 profiles resolve to 29 distinct fingerprint bundles without collisions in the sampled workspace. It is a collision measure, not a cloaking promise.
- **Grade B** is the project's own internal scale. It is deliberately not an A, because engine-level surfaces are unimplemented.

### Browser smoke (`npm run test:ui`)

Highlights from the 31 passing checks:

- 24 profile rows render on first paint; all seven sidebar views load.
- IBM Plex Sans is the active computed font.
- `no gradients or dashed borders · 0 offenders`.
- Command palette opens with Ctrl/⌘ + K.
- 250 profiles can be created without an artificial cap.
- The local JavaScript probe passes `22 of 22 checks`.
- Six independent detector links are present.
- Dark and light themes both render.
- A desktop-to-Android command is created successfully.
- Proxy add flow works.
- Official marks and circular flags load locally, with no external requests.
- `no horizontal page overflow · 0px`.
- No console errors.

### Device matrix (`npm run test:devices`)

`75/75` checks across Google Pixel 8, Xiaomi 13, Samsung Galaxy S23, OPPO Find X6 and Vivo X90. Each device is checked for horizontal overflow, clipped gutters, tap-target overlap, bottom navigation behaviour, dialog fit, table scrolling and export-row layout. Report: [`assets/screenshots/devices/report.json`](../assets/screenshots/devices/report.json).

## Visual verification

The 13 desktop screenshots in `assets/screenshots/` are captured from the running app by Playwright with a real Chromium build:

`01-profiles-light`, `02-profile-detail`, `03-create-profile`, `04-command-palette`, `05-proxies`, `06-devices-sync`, `07-fingerprints`, `08-leak-check`, `08b-leak-check-result`, `09-activity`, `10-settings`, `11-profiles-dark`, `og-image`.

Screenshots were reviewed visually, not only by assertion. Two defects were found and fixed that way: a duplicated top-left logo/New-profile control in the shell, and stacked export icons on mobile which now use a horizontal `Stack`.

## Detector sites

The app links to IP Fighter, Pixelscan, IPHey, AmIUnique, CreepJS and BrowserLeaks and provides an in-app probe so a profile can be inspected without leaving the workspace.

Direct Chromium navigation from this sandbox to `iphey.com`, `pixelscan.net`, `amiunique.org` and `ipfighter.com` failed with `net::ERR_CONNECTION_CLOSED`. Content was readable through a server-side fetch, which confirms the endpoints exist but does not constitute a detector run.

Therefore: **no third-party detector score is claimed.** The in-app probe result (`22 of 22`) is a local self-test of Joe Browser's own payload, not an independent verdict. To evaluate independently, launch a native profile, open the detector links and compare proxy exit country, timezone, locale, WebRTC candidates and Client Hints for yourself.

## Environment limits

- No display server: Electron GUI was not run locally; the shared UI was validated in Chromium at the same code path.
- No JDK or Android SDK: `npm run test:java` parses sources only. Real compilation happens in GitHub Actions.
- No Wine: the Windows installer cannot be executed locally. Artifact existence, size and checksums come from the release workflow.
- GitHub Actions log download is blocked in this sandbox; job status, artifacts and published releases were verified through the API instead.

## What is not claimed

- Not "100% undetectable", not "passes Pixelscan/IPHey/CreepJS" and not "AdsPower-tier".
- No claim of parity with C++-patched browsers such as ShardBrowser, Camoufox, Donut/Wayfern or OVO.
- No claim that TLS/JA4, HTTP/2, QUIC, font rasterisation, GPU driver output or CDP side channels are spoofed.
- No claim that the Android APK is production-signed; CI builds are debug-signed and published with checksums.
