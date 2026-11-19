# Executed checks · local Linux workspace

|Command|Observed result|
|---|---|
|`npm ci` then `npm test`|51 passed across six files.|
|`npm run build`|TypeScript and production web bundle succeeded.|
|`node scripts/test-boot-retry.mjs` after build|Headless Chromium: block initial JS, click static retry, block App chunk, click fallback retry; three document requests.|
|`npm run test:java`|Four Java sources parsed; not an SDK compilation.|
|`npm run check:bridges`|Declared methods and extras agreed; generated asset check not exercised before asset generation.|
|`bash -n scripts/build-apk.sh`; invoke without signing inputs|Syntax accepted; build refused missing signing store. Not positive signing verification.|

No native Windows installation, Android emulator/device launch, staging auth, payment, live proxy or external browser-diagnostics results at this checkpoint.
