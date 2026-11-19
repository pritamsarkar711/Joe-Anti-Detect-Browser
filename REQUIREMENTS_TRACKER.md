# Requirement groups · first checkpoint

This is a phase-level index, not yet a feature-by-feature acceptance record. Unless evidence is linked, the final result is **not verified**.

|Phase / requirement|Status|Location, gap and next verification|
|---|---|---|
|1–2 inventory and audit|PARTIALLY IMPLEMENTED|PROJECT_AUDIT.md; expand to individual controls, permissions and tests.|
|3 startup recovery|PARTIALLY IMPLEMENTED|index.html and src/boot.tsx; two web failure paths tested. Repeat on both installed shells, including offline cold start.|
|4 engine|PARTIALLY IMPLEMENTED|apps/desktop, apps/android; inspect packaged runtime version on clean Windows and supported WebView versions on Android.|
|5 profiles and devices|PARTIALLY IMPLEMENTED|packages/core, src/state; run CRUD, import/export and two-profile storage/clear tests on each engine.|
|6 privacy|PARTIALLY IMPLEMENTED|packages/fingerprint; verify actual engine capabilities and stability; no diagnostic score recorded.|
|7 proxies|PARTIALLY IMPLEMENTED|packages/core/src/proxy.ts; test credentials, timeout, isolation and failure without fallback to direct traffic.|
|8 extensions|PARTIALLY IMPLEMENTED|apps/desktop/extensions.cjs; verify consent, integrity, removal and engine-specific compatibility.|
|9 history and controls|PARTIALLY IMPLEMENTED|src/ui and native shells; compare two profiles after restart and exercise individual controls.|
|10–11 accounts, administration, plans|PARTIALLY IMPLEMENTED|supabase/migrations, supabase/functions, packages/core/src/plans.ts; verify recovery, cross-user denial, server-side lifetime limits and expiration in staging. No payment or admin provisioned.|
|12 UI|PARTIALLY IMPLEMENTED|src/theme.ts, src/styles.css; keyboard, overflow and modal walkthrough pending.|
|13 Android compatibility|BLOCKED BY TECHNICAL LIMITATION|No adb on PATH; run install, resume, rotation and upgrade matrix with OS and WebView versions.|
|14 Windows performance|BLOCKED BY TECHNICAL LIMITATION|No native Windows host here; measure cold/warm launch, idle CPU, peak RAM and subprocess count after shutdown.|
|15 security|PARTIALLY IMPLEMENTED|See SECURITY_AUDIT.md; dependency findings open.|
|16 testing|PARTIALLY IMPLEMENTED|See TEST_REPORT.md; full native and auth E2E outstanding.|
|17 workflows|PARTIALLY IMPLEMENTED|.github/workflows; new recovery test added to CI, signing positive path outstanding.|
|18 production artifacts|BLOCKED BY TECHNICAL LIMITATION|No signed candidate validated. Install twice with identical signer and verify data survives upgrade.|
|19 docs and licensing|PARTIALLY IMPLEMENTED|README, NOTICE, docs and assets/screenshots; reconcile claims and provenance against tested builds.|
|20 research|PARTIALLY IMPLEMENTED|See OPEN_SOURCE_RESEARCH.md; no engine selection change approved.|
|21 acceptance|PARTIALLY IMPLEMENTED|No end-to-end platform acceptance recorded; keep publication gated.|
|22 publication|MISSING|No new release, merge or verified attachments at this checkpoint.|
