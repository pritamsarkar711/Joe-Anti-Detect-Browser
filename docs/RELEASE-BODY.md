## Joe Browser 3.2.1

**3.2.0 does not start — 3.2.1 fixes it.** The 3.2.0 installers opened a window
that sat forever on "Starting Joe Browser…". Root cause: the release pipeline
packaged the web bundle (absolute `/assets/…` paths) inside the EXE instead of
the desktop bundle; under `file://` every script 404'd and nothing could ever
boot. 3.2.1 packages the correct relative-base bundle, and the pipeline now
refuses to publish a UI that does not boot: the built HTML is checked statically,
loaded in a real Chromium over `file://`, checked again inside the assembled
asar, and finally booted in real Electron on the Windows runner before any
asset is published.

Binaries are listed at the bottom of these notes. `SHA256SUMS.txt` contains a
checksum for every file in the release — verify it before running anything.

**What 3.2.1 fixes**
- The packaged Windows app boots: the workspace renders instead of the eternal
  startup splash (reproduced and verified over `file://` in a real Chromium)
- The release pipeline builds `apps/desktop/web-dist` (relative base) and ships
  exactly that — previously it shipped the web `dist/` build by mistake
- `scripts/check-webdist.mjs` fails any UI bundle whose references are absolute
  or missing; `scripts/boot-check-web.mjs` fails any bundle that does not
  actually mount from `file://`; `check-asar` now reads the packed
  `web-dist/index.html` and verifies every reference resolves *inside the
  archive*; `scripts/boot-check.cjs` boots the manager window in real Electron
  on the Windows release runner before anything publishes
- Android: the manager WebView enables `setAllowFileAccessFromFileURLs` so ES
  module scripts can load from `file:///android_asset/` on API 30+ (without it
  the same splash-forever failure ships to phones); the UI is still confined to
  bundled assets — anything else is refused and opened outside

**What 3.2.0 delivered (unchanged here)**
- Real Supabase authentication with server-enforced plans and administrator
  flag (RLS + `guard_account_plan` trigger; no in-app upgrade button)
- Validated EXE⇄APK commands via the `joe-command-validate` edge function
- Real per-profile browsing history and real browser controls on Windows and
  Android (tabs, navigation, find, zoom, bookmarks, downloads, permissions)
- Browsed pages cut off from the app's IPC bridge; Android manager WebView
  refuses to navigate anywhere but its bundled assets
- Honest engine picker: one bundled Chromium with four compatible identities —
  Firefox is not offered because no Gecko runtime ships
- "Paste as human" replays reviewed keystrokes through CDP with per-key delays;
  CAPTCHA challenges stay with a person
- Free-tier quota enforced on every profile-adding path; service-role keys
  refused in Settings; credential-shaped-string scan gates CI and releases

**Validation** (this environment: Debian, Node 22, no JDK/Android SDK):
`tsc` clean; `npm test` 117/117; `test:ui` 37/37; `test:devices` 75/75;
`test:fingerprint` 29/29; `test:site` 15/15; `test:java` 4/4;
`test:icons` 9/9; `test:desktop` 11/11; `check:bridges` 7/7; `test:packaged` 4/4;
`test:main` 16/16; `test:ui-desktop` 5/5; `test:webdist` 2/2; `test:boot-web`
boots the real bundle from `file://` (and the harness was self-tested against
the broken bundle, which it rejects); `npm audit` 0. The release workflow boots
the manager window in real Electron on the Windows runner as a publish gate.

**Honest scope**: profile isolation, fingerprint coherence and history work as
described for the surfaces the app controls. Joe Browser does not ship a patched
Chromium or Firefox kernel, so TLS/JA4, HTTP/2 frame order, QUIC, font
rasterisation, GPU driver behaviour and CDP side channels remain
engine-controlled. It is **not undetectable**, no third-party detector score is
claimed, and the app was not tested on physical Windows or Android devices by
this build environment.

Built by GitHub Actions from tagged source in this repository.
Source: MIT · docs and brand assets: CC BY-ND 4.0 · see NOTICE and TRADEMARK.md.
