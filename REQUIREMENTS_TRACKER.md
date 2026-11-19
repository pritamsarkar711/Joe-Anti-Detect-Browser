# Requirement groups — initial triage

No group has passed final acceptance. Locations below are inspection starting points; each last column is the next verification gate, not a passing result.

|Phase / requirement|Status|Location; gap and next test|
|---|---|---|
|1–2 inspection and traceability|PARTIALLY IMPLEMENTED|PROJECT_AUDIT.md; expand group rows into individual controls and trace every handler.|
|3 startup / recovery|PARTIALLY IMPLEMENTED|index.html, boot.tsx, desktop/main.js; bundle retry tested. Repeat offline cold/warm starts and kill renderer on installed clients.|
|4 independent engines|PARTIALLY IMPLEMENTED|Electron and BrowserActivity; Android depends on system WebView. Inventory shipped versions on clean systems; distinguish presets from engines.|
|5 profile lifecycle and isolation|PARTIALLY IMPLEMENTED|store.tsx, desktop/main.js, Android activities; seed two profiles, switch repeatedly, inspect cookie/IDB/history and clear only one.|
|6 privacy and compatibility|PARTIALLY IMPLEMENTED|packages/core and fingerprint; no external diagnostic results this run. Verify actual engine properties, without challenge-bypass behavior.|
|7 proxy handling|PARTIALLY IMPLEMENTED|core/proxy.ts, ProxiesView; check authenticated proxy, timeout and failure without direct fallback.|
|8 extensions|PARTIALLY IMPLEMENTED|desktop/extensions.cjs; verify integrity against trusted publisher, permissions and lifecycle with supported runtime.|
|9 history and controls|PARTIALLY IMPLEMENTED|HistoryView, PasteAsHuman, native shells; exercise real navigation and history deletion in two profiles.|
|10 auth / admin|PARTIALLY IMPLEMENTED|AuthView and supabase/migrations; test two users, recovery and unauthorized mutations on staging. No admin provisioned.|
|11 plans|PARTIALLY IMPLEMENTED|core/plans.ts; client policy is insufficient. Implement transactional server limits; test concurrent creation, delete/recreate and subscription expiry.|
|12 design|PARTIALLY IMPLEMENTED|src/ui and styles.css; inspect forms at narrow widths with keyboard and large text.|
|13 Android matrix|PARTIALLY IMPLEMENTED|scripts/device-matrix.mjs tests viewports, not OEM devices. Test activity resume, rotation and WebView versions on Android.|
|14 Windows performance|MISSING|No baseline measured here. Record cold/warm startup, CPU and resident memory before/after closing profiles.|
|15–16 security and tests|PARTIALLY IMPLEMENTED|See security/test reports. Require real account and installed-client E2E.|
|17 CI|PARTIALLY IMPLEMENTED|.github/workflows; run revised workflows against exact candidate SHA.|
|18 binaries|BLOCKED BY TECHNICAL LIMITATION|Linux checkout without adb or Windows desktop. Require signed candidate, install/update/uninstall on targets.|
|19 documentation|PARTIALLY IMPLEMENTED|README, NOTICE, docs; reconcile claims and refresh screenshots after verification.|
|20 research|PARTIALLY IMPLEMENTED|docs/RESEARCH.md; dependency/license review outstanding.|
|21–22 acceptance and publication|MISSING|No accepted binaries; no version bump or public release.|
