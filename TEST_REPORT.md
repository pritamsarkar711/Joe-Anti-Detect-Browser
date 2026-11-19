# Executed checks · local Linux workspace · 2026-11-19 second checkpoint

|Command|Observed result|
|---|---|
|`npm ci` then `npm test`|**74 passed across eight files** (was 51/6): core, fingerprint, v3, boot, auth (10, Supabase flows), command-function (13, edge relay).|
|`npx tsc --noEmit`|0 errors after auth, relay and keystroke-replay changes.|
|`npm run build`|TypeScript and production web bundle succeeded (App chunk 487 kB, under the 700 kB gate).|
|`npm run build:core` / `build:desktop` / `build:android-ui` / `build:assets` / `build:site`|All succeeded; site built from branch `arena/b1bb6b1a-joe-anti-detect-browser`.|
|`npm run test:java`|Four Java sources parsed cleanly; not an SDK compilation. Lambda check included.|
|`npm run test:icons`|**9/9** brand checks, including the new guard that published favicons and the README logo match `Brand.tsx`'s J monogram.|
|`npm run test:desktop`|8/8 packaging checks.|
|`npm run check:bridges`|5/5; declared methods, extras and generated assets agree.|
|`npm run test:site`|**15/15** against `dist-site`.|
|`npm run test:fingerprint`|**29/29** self-tests.|
|`npm run test:packaged`|4/4; packaged renderer boots.|
|`npm run test:main`|**16/16** main-process smoke checks, including `keystrokes:send` (3 keys dispatched via CDP, invalid plans and closed windows refused) and `sync:send` failure reporting.|
|`npm run test:ui-desktop`|5/5; bundle boots from `file://`.|
|`npm run test:ui` (live dev server)|**35/35** Playwright checks — profiles, detail, tools, activity, history, extensions, settings, palette.|
|`npm run test:devices` (live dev server)|**75/75** across five Android families; `assets/screenshots/devices/*` regenerated from real captures.|
|`node scripts/test-boot-retry.mjs` after build|Headless Chromium: block initial JS, click static retry, block App chunk, click fallback retry; three document requests.|
|`bash -n scripts/build-apk.sh`; invoke without signing inputs|Syntax accepted; build refused missing signing store. Not positive signing verification.|
|`npm audit` and `npm audit --omit=dev`|**0 vulnerabilities** in both (was 11 entries, 2 critical).|
|Supabase live queries (connector)|Migration `accounts_and_licensing` applied; 3 entitlement rows backfilled (owner → unlimited); anon INSERT into `commands` **denied 42501**; auth config on canonical Vercel origin; edge function `joe-command-validate` v3 ACTIVE.|
|`fetch_page` to the deployed edge function|**Blocked** — this sandbox only reaches github/npm/pypi hosts. Live relay invocation pending device test.|

No native Windows installation, Android emulator/device launch, staging auth
sign-up, payment, live proxy or external browser-diagnostics results at this
checkpoint. No screenshot shows the account screen, and none is claimed to.
