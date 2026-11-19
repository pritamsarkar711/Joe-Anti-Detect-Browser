# Evidence — Linux, Node 22.22.3

- `npm ci`, `npm test`: 6 files, 51 tests passed. `npm run build`: TypeScript and web production bundle passed.
- `node scripts/check-startup.mjs`: blocked entry JS in headless Chromium; waited for visible retry, restored assets, clicked retry, observed hidden boot shell and nonempty React root. No external website involved.
- `build:desktop`, `build:android-ui`: passed; both generated indexes have relative JS entry URLs. `build:core`, `build:assets`: passed.
- `test:java`, `test:icons`, `test:desktop`, `check:bridges`, `test:packaged`, `test:main`, `test:ui-desktop`: exit 0. Packaged/main tests stub Electron. Main smoke logged an injection error and missing desktop Supabase dependency in this root-only install; its green exit is **not** proof those paths work.
- `bash -n scripts/build-apk.sh`: syntax only. No APK signature, installer, native dialog, Android lifecycle, Windows performance, hosted auth or payment was tested. No new device screenshots or detector scores.
