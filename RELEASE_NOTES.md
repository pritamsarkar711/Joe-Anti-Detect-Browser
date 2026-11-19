# RELEASE_NOTES — Joe Browser

Release notes for published builds. Binaries are built and published only by
`.github/workflows/release.yml` from a tag; checksums ship as `SHA256SUMS.txt`.
Never run a binary whose checksum does not match.

## 3.2.0 (2026-11-19)

Tag: `v3.2.0`. Files: `JoeBrowser-Setup-3.2.0.exe` (NSIS installer),
`JoeBrowser-Portable-3.2.0.exe`, `JoeBrowser.apk` (Android 9+, sideload),
`SHA256SUMS.txt`.

### Headlines

- **Real per-profile browsing history.** Both shells now record every visit —
  URL, title, time, and search-result detection — as profiles browse. Until
  now the History view only ever showed seeded demo rows: the recorder side of
  the feature had never been written.
- **Real browser controls in every profile window.** Tabs, back, forward,
  reload/stop, home, address bar (URL or search), find on page with match
  counts, zoom, per-profile bookmarks, downloads list and deny-by-default site
  permissions on Windows; the Android window gains the same controls natively
  (tabs = parallel profile windows there, one WebView per isolated process).
  Keyboard shortcuts on Windows map to the same commands.
- **Real Supabase cloud accounts.** Sign-up with email confirmation, secure
  login, session persistence and refresh, password reset and change, and
  server-side entitlement lookup — active whenever project keys are set in
  Settings → Sync. Local-first mode is unchanged and still stores no password.
- **Server-side plans and admin.** The free 2-profile limit, the admin role and
  subscription state are now enforced in Postgres (entitlements table with
  strict RLS, quota trigger on every insert and workspace move, ADMIN_ONLY
  management RPCs, isolated per-user workspaces provisioned at signup), not
  just in the client.

### Security

- **Fixed (critical):** pages opened in profiles received the app's management
  bridge (`window.joe`) — a website a profile visited could drive the whole
  workspace. Browsed pages now run with no preload at all; the bridge is
  limited to bundled pages and localhost dev servers. The Android manager
  WebView can no longer navigate away from its bundled assets.
- Dependency tree is at **0 known vulnerabilities** (vitest 5, esbuild 0.28,
  lodash 4.18 overrides); CI now fails on shipped-code advisories and on
  credential-shaped strings anywhere in the repository.

### Fixes and honesty

- Every version surface (shell, Android UA and device info, site, manifest)
  derives from package.json — the shell no longer reports a stale version.
- "Unlock Premium" was a local flag flip with no payment behind it; it is now
  "Preview Premium" and says plainly that no payment provider is connected and
  nothing is charged.
- The site build embeds the branch that actually built it (it pointed at a
  branch that no longer existed).
- New regression gates: version-consistency suite, backend policy suite,
  history suite, auth suite, secret scan, chrome.html packaging check, and
  main-process toolbar routing checks.

### Validation (this build)

`tsc` clean; unit/SSR/backend **87/87**; fingerprint **29/29**; site **15/15**;
Java **4/4**; icons **8/8**; desktop packaging **11/11**; bridges **6/6**;
packaged boot **4/4**; main process **15/15**; renderer **5/5**; secrets **3/3**;
`npm audit` **0**. Environment limits (no Windows hardware, no live Supabase
probe, emulator-only Android) are recorded in `docs/VALIDATION.md` and
`TEST_REPORT.md`.

### Honest scope

JavaScript-visible surfaces are made coherent per profile. Joe Browser does not
ship a patched Chromium or Firefox kernel: TLS/JA4, HTTP/2 frame order, QUIC,
font rasterisation, GPU driver behaviour and CDP side channels remain
engine-controlled. It is not undetectable and no third-party detector score is
claimed. For legitimate QA, testing, ad verification, privacy research and
management of your own accounts.

---

## 3.1.1

Recovered the 3.1.0 launch failure (missing `extensions.cjs` in the
installer), UI↔shell workspace sync, Android launcher icon/splash, Supabase
settings propagation, and the packaging gates that catch those classes of bug.
See the GitHub release body for the full list.

## 3.1.0

**Broken release — do not use.** The installer omitted a module required at
launch; Windows showed `Error: Cannot find module './extensions.cjs'`. Superseded
by 3.1.1.
