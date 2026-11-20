## Joe Browser 3.2.2

This release ships **both platforms**: verified-boot Windows EXEs and a real,
installable Android APK. 3.2.1 fixed the v3.2.0 startup bug (the packaged app
sat forever on "Starting Joe Browser…"); 3.2.2 goes further — the release
pipeline now boots the profile-window toolbar in real Electron on the Windows
runner, and Android finally gets an APK in the release.

Binaries are listed at the bottom of these notes. `SHA256SUMS.txt` contains a
checksum for every file — verify before running anything.

**Windows: first run.** The EXEs are not code-signed with a purchased
certificate (that costs money this project does not have yet), so Windows
SmartScreen shows "Windows protected your PC". Click **More info → Run
anyway**. This warning says "unknown publisher", not "malware" — and you can
verify the download against `SHA256SUMS.txt` before running it.

**Android: how this APK is signed.** The APK in this release is built and
signed by CI. If the repository has the owner's `JOE_SIGNING_*` secrets it
carries one stable identity (updates install over older versions); otherwise
it is signed with a **per-build key** — it installs and runs today, but a
later build will have a different signature, so updating means uninstalling
first. `Android-signing.txt` states exactly which mode was used and lists the
certificate SHA-256 fingerprint — check it against what your device reports.
`scripts/setup-signing.sh` (run once) moves every future release to a stable
key.

**What 3.2.2 adds**
- Android APK in the release (a real, installable app: profiles, fingerprint
  injection, proxies, history, sync), with its signing status and certificate
  fingerprint published alongside it (`Android-signing.txt`)
- `scripts/setup-signing.sh`: one command that creates the release keystore on
  the owner's machine and pushes the four signing secrets — the private key
  never touches the repository
- The Windows release gate now also drives the real profile-window toolbar
  (`chrome.html`) in Electron: it must render a tab strip and address bar from
  the main process's `nav:state` before anything publishes
- APK signing accepts JKS and PKCS#12 keystores and always records the signer's
  fingerprint

**What 3.2.1 fixed** (carried forward): the packaged Windows app boots —
v3.2.0's pipeline shipped the web bundle (absolute `/assets/…` paths) inside
the EXE and every script 404'd under `file://`. Four gates now refuse to
publish an app that does not boot: static `file://` reference check,
real-Chromium boot, asar-content verification, and the real-Electron boot
checks on the Windows runner.

**What 3.2.0 delivered** (unchanged): real Supabase authentication with
server-enforced plans and administrator flag; validated EXE⇄APK commands via
the `joe-command-validate` edge function; real per-profile browsing history
and real browser controls on Windows and Android; browsed pages cut off from
the app's IPC bridge; honest engine picker (one bundled Chromium, four
compatible identities — Firefox is not offered); "Paste as human" keystroke
replay with CAPTCHA left to a person; free-tier quota on every path;
service-role keys refused in Settings; credential-scan and zero-vulnerability
gates.

**Validation** (this environment: Debian, Node 22, no JDK/Android SDK/device):
`tsc` clean; `npm test` 118/118; `test:ui` 37/37; `test:devices` 75/75;
`test:fingerprint` 29/29; `test:site` 15/15; `test:java` 4/4; `test:icons` 9/9;
`test:desktop` 11/11; `check:bridges` 7/7; `test:packaged` 4/4; `test:main` 16/16;
`test:ui-desktop` 5/5; `test:webdist` 2/2; `test:boot-web` boot pass with a
self-tested harness; `npm audit` 0. The release workflow boots the manager
window **and** the profile toolbar in real Electron on the Windows runner, and
`apksigner verify` checks the APK, before anything publishes.

**Honest scope**: profile isolation, fingerprint coherence and history work as
described for the surfaces the app controls. Joe Browser does not ship a patched
Chromium or Firefox kernel, so TLS/JA4, HTTP/2 frame order, QUIC, font
rasterisation, GPU driver behaviour and CDP side channels remain
engine-controlled. It is **not undetectable**, no third-party detector score is
claimed, and the app was not tested on physical Windows or Android devices by
this build environment.

Built by GitHub Actions from tagged source in this repository.
Source: MIT · docs and brand assets: CC BY-ND 4.0 · see NOTICE and TRADEMARK.md.
