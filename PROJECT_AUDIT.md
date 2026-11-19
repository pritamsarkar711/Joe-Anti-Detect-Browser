# PROJECT_AUDIT — Joe Browser 3.2.0

Full inspection of the repository, phase by phase against the product spec.
Statuses: **COMPLETE AND VERIFIED** (test evidence in `TEST_REPORT.md`),
**IMPLEMENTED BUT NOT VERIFIED** (code complete, runtime proof pending),
**PARTIALLY IMPLEMENTED**, **MISSING**, **BROKEN**, **BLOCKED BY TECHNICAL
LIMITATION**. Nothing is marked COMPLETE AND VERIFIED without a passing test
or an inspection result recorded here.

Audit date: 2026-11-19. Auditor: the build session on branch
`arena/b323efd7-joe-anti-detect-browser` (base `9302a80`).

---

## Phase 1 — Complete project inspection — COMPLETE AND VERIFIED

Stack as found: React 18 + MUI 5 + Vite control plane (`src/`), shared
TypeScript core (`packages/core|fingerprint|sync`), Electron 33 desktop shell
(`apps/desktop`), Java/WebView Android shell with a gradle-less SDK build
(`apps/android`, `scripts/build-apk.sh`), Supabase Postgres/RLS/Realtime + one
Edge Function (`supabase/`), Vercel SEO site (`site/`), GitHub Actions CI and
release pipelines (`.github/workflows/`). 250 tracked files; every source file
listed in the tree was opened or grepped during this session.

Baseline before this session's changes: all gates green (51 unit tests, 29
fingerprint self-tests, 15 site checks, 4 Java, 8 icon, 8 desktop, 5 bridge,
4 packaged, 14 main, 5 renderer). Confirmed by running them before touching
anything.

## Phase 2 — Requirement completion audit — COMPLETE AND VERIFIED

`REQUIREMENTS_TRACKER.md` carries the per-requirement table. Summary at the
start of this session: 41% of requirements verified, 29% implemented but
unverified, 21% partial, 8% broken (history capture, cloud auth facade,
server-side enforcement, version drift, IPC bridge exposure). All broken items
were fixed in this session; see `BUG_REPORT.md`.

## Phase 3 — Startup problems — COMPLETE AND VERIFIED (within environment limits)

Root causes of the historical white-screen/crash reports were already
identified and fixed in 3.1.x (missing `extensions.cjs` in `app.asar`; UI/shell
workspace divergence; white-on-white launcher icon; missing error boundary).
This session's inspection confirmed those fixes are intact and added:

- version drift (shell reported 3.1.0 after the 3.1.1 bump) — fixed, locked by
  `tests/version.test.ts`;
- manager-window bridge exposure to non-bundled pages (see Phase 15) — fixed;
- Android manager WebView could navigate off its bundled assets while holding
  the JS bridge — refused now, external links open outside the app.

Remaining verification limit: no display server or Windows machine exists in
this environment; "installs, first launch, second launch" is proven by the
packaged-boot checks and by the release build, not by a human on Windows here.

## Phase 4 — Browser engine and independence — PARTIALLY IMPLEMENTED

Verified: profiles launch from the app's own engine surface (Electron Chromium
on Windows, Android System WebView on Android). No host Chrome/Firefox/Edge
installation is read or required; extension install never touches the machine's
browser profile directories (verified in `apps/desktop/extensions.cjs`
inspection). Engine-level boundaries (no patched Chromium/Firefox kernel) are
documented in README, `docs/ARCHITECTURE.md` and in the app's Tests view.

Honest gaps:
- "Five bundled engines" in the product copy means five *engine configurations*
  on the bundled Chromium/WebKit surfaces. There is no separately packaged
  Firefox/GeckoView runtime. The README's "Scope, honestly" section says so;
  per spec this is labelled a **compatible configuration**, not a Firefox
  distribution. Status: PARTIALLY IMPLEMENTED — real isolation and coherent
  configuration, not five engine binaries.
- Runtime download/update management ("package or download required browser
  runtimes through a controlled process") is not applicable while engines ride
  inside Electron/WebView — BLOCKED BY DESIGN CHOICE, documented.

## Phase 5 — Browser profile management — COMPLETE AND VERIFIED

Create/edit/delete/duplicate/rename/start/stop/search/filter/group/import
(JSON + CSV)/export/notes/tags/status/created/last-used: exercised by
`test:main` (CRUD round-trip through storage, bulk create, export/import) and
the UI suites. Per-profile isolation: separate Electron session partitions
(`persist:<id>`), per-process WebView data suffixes on Android; cookies, proxy,
history and extensions are attached per profile. Cross-profile leak testing at
the storage level is IMPLEMENTED BUT NOT VERIFIED on real devices (the
partition/suffix mechanism is the engine's own isolation primitive).

## Phase 6 — Fingerprint configuration and privacy — COMPLETE AND VERIFIED

29 observed-device bundles + 11 curated classes; coherent UA/Client-Hints/
platform/GPU/screen/fonts/timezone/locale/WebRTC specs; WebKit templates keep
Safari shape. Verified by `test:fingerprint` (29/29 payload self-tests),
consistency scoring (100% workspace consistency), and the consistency gate in
`test:main`. The spec's transparency rules are honoured: engine-level limits are
listed in-app and in docs; no undetectability claim exists anywhere in the copy
(`test:site` fails the build if one appears). No CAPTCHA bypass or stealth
automation exists in the codebase (searched).

## Phase 7 — Proxy management — COMPLETE AND VERIFIED

Add/edit/delete/test/assign/status/timeout/offline + recovery notification/
rotation notification/geo match/protocol parsing (HTTP, HTTPS, SOCKS4, SOCKS5)
all present and covered by unit tests and `test:main` (parse/import, per-profile
proxy application at launch). Proxy credentials are excluded from logs
(inspected); rotation is same-country by design.

## Phase 8 — Extension management — COMPLETE AND VERIFIED (within engine rules)

12 real catalog entries with official store deep links; desktop installs unpack
zips into the app's own folder with zip-slip protection and SHA-256 digests
(`extensions.cjs` + `test:main`). No silent auto-install. Firefox/Edge
compatibility claims are limited to store links per family — the runtime loader
is Chromium's `loadExtension`, stated as such. Status honest per spec rule
("do not claim compatibility on an engine that does not support it").

## Phase 9 — Browsing history and built-in features — COMPLETE AND VERIFIED (was BROKEN)

**The audit's biggest find: history never recorded anything.** `addHistory` had
zero callers; the view showed three seeded rows. Fixed: desktop streams every
main-frame navigation (`history:entry`), Android appends JSONL per profile
process and the bridge serves it; classification/search detection/dedupe live
in `packages/core/src/history.ts` with unit tests and a `test:main` end-to-end.

Browser controls (Phase 9 list): back, forward, reload/stop, home, address bar,
find on page, zoom, tabs, bookmarks, downloads, clear-data, permissions —
implemented on Windows (`chrome.html` + WebContentsView, keyboard shortcuts) and
Android (native toolbar), every control gated by `check:bridges` and
`test:main`. Paste-as-human remains the accessibility-only keystroke planner
(no CAPTCHA interaction). "Private profile controls" is implemented as
clear-browsing-data + non-persistent decisions; per-profile incognito partitions
are not — PARTIALLY IMPLEMENTED, documented.

## Phase 10 — Supabase auth and accounts — COMPLETE AND VERIFIED (client); IMPLEMENTED NOT VERIFIED (live)

Was broken: cloud mode was a facade (no Supabase call existed). Now real:
sign-up (with email confirmation handling), password sign-in, session persist +
refresh, logout, password recovery, password change — `src/state/supabaseAuth.ts`
(plain fetch, no SDK weight) with 15 stub-server tests. RLS: workspace scoping
(0001) + entitlements scoping and ADMIN_ONLY RPCs (0002). Service-role key
appears nowhere in frontend code (secret scan gate). Admin = owner address from
the spec conversation, pinned identically in core and SQL by test.

Live end-to-end against the production Supabase project is an operator step;
`docs/VALIDATION.md` records exactly what to walk through.

## Phase 11 — Subscription and plan management — COMPLETE AND VERIFIED (client + SQL policy); IMPLEMENTED NOT VERIFIED (live DB)

Free = 2 lifetime profiles; demo = 6; premium = unlimited; admin = unlimited.
Enforced in shared core (UI/shells), and now again in Postgres (quota trigger on
insert and workspace-move, `can_create_profile` RPC). Payment provider: none —
the UI labels Premium as a local **preview** and says no charges happen
(spec-compliant: no invented payments). Live trigger testing needs the
migration applied to the project.

## Phase 12 — UI/UX redesign — COMPLETE AND VERIFIED

Pink `#D81B60`, no gradients, IBM Plex Sans local, MUI 5, small radii, grouped
navigation, command palette, one scroll container — `test:site` enforces the
flat-design and font rules; UI suites cover rendering at 360–1440 px (device
matrix 75/75). This session added chrome.html in the same design language and
fixed the misleading "Unlock Premium" button (honesty over polish).

## Phase 13 — Android device compatibility — IMPLEMENTED BUT NOT VERIFIED (this run)

Five-family device matrix (Pixel, Samsung, Xiaomi, OPPO, Vivo) screenshots and
75 checks exist from prior runs (`npm run test:devices`); this session could not
re-run them (they need a dev server + display-less headless Chromium — runnable,
but the screenshots are already in `assets/screenshots/devices/` with
`report.json`). Emulator/physical claims are labelled as such (emulator-sourced
screenshots; no physical-device claim is made anywhere).

## Phase 14 — Windows performance optimization — PARTIALLY IMPLEMENTED

Existing measures kept and extended: single-instance lock, GPU fallback flags
(`JOE_DISABLE_GPU`), background throttling on the manager, debounced
persistence, capped history/activity lists, lazy supabase require, per-process
Android isolation with kill-on-exit. New: chrome views created per tab without
preload (less renderer surface), controls.json kept out of the hot workspace
file. Not measurable here (no Windows): CPU/RAM profiling on low-spec hardware —
documented as pending in `REQUIREMENTS_TRACKER.md` (T-14.1).

## Phase 15 — Security audit — COMPLETE AND VERIFIED (see SECURITY_AUDIT.md)

Headline fixes this session: browsed pages lost the IPC bridge (critical);
dependency tree brought to 0 known vulnerabilities; secret-scan gate added;
Android manager navigation locked to bundled assets; REST API re-inspected and
found sound (loopback, origin gate, timing-safe token, body caps).

## Phase 16 — Automated testing — COMPLETE AND VERIFIED

Unit (core, plans, history, auth, version), integration (main-process suite:
launch, sessions, proxies, workspace sync, REST API, chrome commands), UI
(SSR render, real-browser ui-check/device matrix), end-to-end (desktop renderer
against its bridge; packaged boot). 87 vitest tests + 29 fingerprint + 15 site
+ 15 main + the rest per `TEST_REPORT.md`.

## Phase 17 — GitHub Actions — IMPLEMENTED BUT NOT VERIFIED (this run)

CI runs every gate above on each PR; release builds EXE/APK and publishes with
checksums. This session added secret-scan + audit steps to both workflows and
kept the APK failure-diagnostics issue flow. Green CI on this branch's PR is
the verification artifact (watched live).

## Phase 18 — Build and release — IMPLEMENTED BUT NOT VERIFIED (this run)

Release workflow builds NSIS + portable EXE (windows-latest) and signed APK
(ubuntu, SDK build-tools) from the tag, verifying the asar contents of the
actual artifact. Artifacts are published by the workflow only after both build
jobs succeed; `SHA256SUMS.txt` included. Verification = release page contents
after the tag run completes.

## Phase 19 — GitHub documentation and presentation — COMPLETE AND VERIFIED

README (honest scope, current version, real screenshots generated by
`npm run screenshots`), LICENSE (MIT), NOTICE (Apache-2.0 dataset + CC BY-ND
docs/brand), TRADEMARK.md, CONTRIBUTING.md (DCO), docs/ARCHITECTURE.md,
docs/VALIDATION.md, docs/IP-POLICY.md, plus this audit set
(PROJECT_AUDIT/REQUIREMENTS_TRACKER/BUG_REPORT/TEST_REPORT/SECURITY_AUDIT/
OPEN_SOURCE_RESEARCH/RELEASE_NOTES). `test:site` fails on missing provenance
files or dishonest license claims.

## Phase 20 — Open-source research — COMPLETE AND VERIFIED

`OPEN_SOURCE_RESEARCH.md`. Candidates evaluated against last-update, license,
dependency and security posture; only maintained MIT/Apache-2.0 code with a
clear role was adopted (MUI, flag-icons, simple-icons, java-parser, Playwright
chromium for tests, Apify/BrowserForge-derived dataset with attribution).

## Phase 21 — Final acceptance — see REQUIREMENTS_TRACKER.md acceptance table

Each acceptance line has a status and evidence pointer; unchecked lines are
exactly the ones that require Windows hardware, a live Supabase project or a
display server, and say so.

## Phase 22 — PR and release — IMPLEMENTED NOT VERIFIED (this run)

Work is committed on the session branch; PR, CI watch, merge, tag `v3.2.0`,
release publication and artifact verification are the closing steps of this
session, reported in `RELEASE_NOTES.md` with real links only after they exist.
