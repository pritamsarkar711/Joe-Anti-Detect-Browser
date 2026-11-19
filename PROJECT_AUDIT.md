# PROJECT_AUDIT — Joe Browser 3.2.0

Full inspection of the repository, phase by phase against the product spec.
Statuses: **COMPLETE AND VERIFIED** (test evidence in `TEST_REPORT.md`),
**IMPLEMENTED BUT NOT VERIFIED** (code complete, runtime proof pending),
**PARTIALLY IMPLEMENTED**, **MISSING**, **BROKEN**, **BLOCKED BY TECHNICAL
LIMITATION**. Nothing is marked COMPLETE AND VERIFIED without a passing test
or an inspection result recorded here.

Audit date: 2026-11-19. Two independent audit threads ran against the same
spec and their work was merged for this release; bugs are numbered
BUG-001…BUG-021 in `BUG_REPORT.md` (the account/database thread's numbering is
primary, the browser/security thread's findings are BUG-019…BUG-021).

## Phase 1 — Complete project inspection — COMPLETE AND VERIFIED

React 18 + MUI 5 + Vite control plane (`src/`), shared TypeScript core
(`packages/core|fingerprint|sync`), Electron 33 desktop shell (`apps/desktop`),
Java/WebView Android shell with a gradle-less SDK build (`apps/android`,
`scripts/build-apk.sh`), Supabase Postgres/RLS/Realtime + Edge Function
(`supabase/`), Vercel SEO site (`site/`), GitHub Actions CI and release
pipelines. Every source file was opened or grepped during the audits.

## Phase 2 — Requirement completion audit — COMPLETE AND VERIFIED

`REQUIREMENTS_TRACKER.md` carries the per-requirement table. Broken items found
and fixed this cycle: hosted authentication absent (BUG-002), owner-by-email
(BUG-001), fake premium unlock (BUG-003), Android sync failing RLS (BUG-004),
workspace membership never provisioned (BUG-005), global primary-key collisions
(BUG-006), import quota bypass (BUG-007), service-role key accepted (BUG-008),
history recorder absent (BUG-019), management bridge exposed to web content
(BUG-020), dependency advisories (BUG-021), version drift (BUG-012).

## Phase 3 — Startup problems — COMPLETE AND VERIFIED (within environment limits)

The 3.1.0 `extensions.cjs` white/crash window was root-caused and fixed in
3.1.1 with packaging gates that reproduce it (`test:desktop`, `test:packaged`,
release-time asar listing). This cycle added: version drift fix (shell/UA/site
derive from package.json, `tests/version.test.ts`), renderer startup recovery
with a Retry path even when the entry script fails (`scripts/test-boot-retry.mjs`,
BUG-017), and the bridge/navigation lockdowns below. Remaining limit: no
Windows host here — install/first-launch/second-launch are proven by packaging
gates and the release build, not by a human on Windows.

## Phase 4 — Browser engine and independence — PARTIALLY IMPLEMENTED

Profiles launch from the app's own engine surface (Electron Chromium on
Windows, Android System WebView). No host browser installation is read or
required. **Honest engine scope:** one bundled Chromium engine; Joe Browser,
Chrome, Edge and Brave are coherent *identities* on it; **Firefox is not
offered** because no Gecko engine is bundled and a Firefox UA on Chromium is a
detectable contradiction — the picker says so. Runtime engine downloads are not
applicable while engines ride inside Electron/WebView.

## Phase 5 — Browser profile management — COMPLETE AND VERIFIED

CRUD/duplicate/rename/tags/notes/status/search/group/import-export covered by
`test:main` and UI suites. Per-profile isolation: Electron session partitions
(`persist:<id>`), per-process WebView data suffixes on Android. Cross-profile
storage leak testing on real devices is IMPLEMENTED BUT NOT VERIFIED.

## Phase 6 — Fingerprint configuration and privacy — COMPLETE AND VERIFIED

29 observed-device bundles + 11 curated classes; coherent specs;
`test:fingerprint` 29/29; workspace consistency 100%. No undetectability claim
exists anywhere (`test:site` fails the build on one). Engine-level limits
(TLS/JA4, HTTP/2 frames, QUIC, fonts, GPU, CDP) documented in-app and in docs.
No CAPTCHA bypass or stealth automation in the codebase.

## Phase 7 — Proxy management — COMPLETE AND VERIFIED

Add/edit/delete/test/assign/status/timeout/offline+recovery/rotation/geo match/
protocol parse; covered by unit tests and `test:main`. Credentials never logged;
rotation is same-country by design. (Known demo-data caveat: seeded Android
fixtures show unmeasured latencies — OPEN-006.)

## Phase 8 — Extension management — COMPLETE AND VERIFIED (within engine rules)

12 real catalog entries with store links per family; desktop installs unpack
zips into the app's own folder with zip-slip refusal, manifest validation and
SHA-256 digests. No silent installs. Chromium-family loading only — stated.

## Phase 9 — Browsing history and built-in features — COMPLETE AND VERIFIED (was BROKEN)

History recorder never existed (BUG-019): fixed on both shells with
classification, deterministic dedupe and native clear; `tests/history.test.ts`
+ `test:main` end-to-end. Browser controls (back/forward/reload/home/address/
find/zoom/tabs/bookmarks/downloads/permissions/clear-data/keyboard) implemented
on Windows (`chrome.html` + WebContentsView) and Android (native toolbar),
pinned by `check:bridges` and `test:main`. Paste-as-human remains an
accessibility-only keystroke planner. Private-profile controls = clear-data +
deny-by-default permissions; true per-launch incognito partitions are PARTIAL.

## Phase 10 — Supabase auth and accounts — COMPLETE AND VERIFIED (stubbed); IMPLEMENTED NOT VERIFIED (live)

Real GoTrue flows (sign-up with confirmation, password login, refresh-token
rotation, recovery, sign-out) in `src/state/cloud.ts` with 21 stub-server
tests; specific error mapping; session persisted and refreshed with an offline
grace entitlement cache (cache can never grant admin — BUG-016). Roles come
only from the server; typing the owner address grants nothing (BUG-001).
`my_entitlement()` is the single plan read; without the migration the app says
so instead of guessing. Live end-to-end against the production project is an
operator step (`SECURITY_AUDIT.md` §8/§9).

## Phase 11 — Subscription and plan management — COMPLETE AND VERIFIED (static); IMPLEMENTED NOT VERIFIED (live DB)

Free 2 lifetime profiles / demo 6 / premium unlimited. Enforced in shared core
and again in Postgres by `enforce_profile_quota()` — on **every** add path
including CSV and workspace import (BUG-007). `entitlements`/`app_admins` are
read-only to users; no client can change a plan. No payment provider exists and
none was invented; Premium is granted by the service role.

## Phase 12 — UI/UX redesign — COMPLETE AND VERIFIED

Pink `#D81B60`, flat, IBM Plex Sans local, MUI 5, small radii, grouped nav,
command palette; `test:site` enforces the rules; 75/75 device-matrix checks.
The "Unlock Premium" button is gone (BUG-003); account screens state where the
plan came from.

## Phase 13 — Android device compatibility — IMPLEMENTED BUT NOT VERIFIED (this run)

Five-family emulator matrix (75 checks + screenshots) self-served by
`npm run test:devices`; no physical-device claim anywhere (emulator-sourced
captures only).

## Phase 14 — Windows performance optimization — PARTIALLY IMPLEMENTED

Single-instance lock, GPU fallback (`JOE_DISABLE_GPU`), throttled manager,
debounced persistence, capped history/activity lists, lazy supabase require,
per-tab views without preload, kill-on-exit Android processes. CPU/RAM
profiling on low-spec hardware pending (T-14.1).

## Phase 15 — Security audit — COMPLETE AND VERIFIED (see SECURITY_AUDIT.md)

Critical bridge exposure to web content closed (BUG-020); service-role keys
refused client-side and scanned for in CI (BUG-008, schema scan +
`test:secrets`); `npm audit` 0 tree-wide (BUG-021); Android sync now
authenticated with the session token so RLS passes (BUG-004); REST API
re-inspected and sound (loopback, origin gate, timing-safe token, 1 MB caps).

## Phase 16 — Automated testing — COMPLETE AND VERIFIED

Unit (core, plans, history, version), account client (21), schema/secret
invariants (12), integration (main-process 15 incl. chrome routing + history
streaming + foreign-sender rejection), UI (SSR + real-browser checks 37 +
device matrix 75), end-to-end (renderer 5, packaged boot 4, boot retry 2).
Full matrix and failure-mode proofs in `TEST_REPORT.md`.

## Phase 17 — GitHub Actions — IMPLEMENTED BUT NOT VERIFIED (this run)

CI runs every gate on each PR (now including secret scan and production-dep
audit); release builds EXE/APK with checksums and verifies the asar contents of
the real artifact. Green CI on the release PR is the verification artifact.

## Phase 18 — Build and release — IMPLEMENTED BUT NOT VERIFIED (this run)

NSIS + portable EXE (windows-latest) and signed APK (externally managed signing
store required — BUG-018) built from the tag; artifacts published only after
both jobs succeed, with `SHA256SUMS.txt`. Verification = the release page after
the tag run.

## Phase 19 — GitHub documentation and presentation — COMPLETE AND VERIFIED

README (honest engine scope, current version, real screenshots), LICENSE
(MIT), NOTICE (Apache-2.0 + CC BY-ND), TRADEMARK.md, CONTRIBUTING.md (DCO),
docs/ARCHITECTURE.md, docs/VALIDATION.md, docs/IP-POLICY.md and this audit set.
`test:site` fails on missing provenance or dishonest license claims.

## Phase 20 — Open-source research — COMPLETE AND VERIFIED

`OPEN_SOURCE_RESEARCH.md` (two research threads merged): maintained MIT/Apache
code with clear roles; nothing GPL vendored; trademarks nominative.

## Phase 21 — Final acceptance — see `TEST_REPORT.md` §5

Every acceptance line carries evidence or an explicit "not verified" note.

## Phase 22 — PR and release — IMPLEMENTED NOT VERIFIED (this run)

Work merged via PR with green CI; tag `v3.2.0`, release publication and
artifact verification are the closing steps, reported with real links only
after they exist.
