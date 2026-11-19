# Joe Browser — architecture

Last updated: v1.0.0. This document is deliberately explicit about what the
project does and what it cannot do.

## 1. Why this stack

| Requirement | Decision | Reason |
|---|---|---|
| One product on Windows + Android | **TypeScript shared core** + thin native shells | Profile model, fingerprint spec, consistency rules and sync protocol are written once and bundled into both clients. V8 (Electron) and ART (Android) derive byte-identical specs from the same seed. |
| Professional, low-text UI | **React 18 + Vite** | The same control plane is embedded in Electron, in the APK's WebView, and deployed on Vercel. |
| Real per-profile isolation on desktop | **Electron** with bundled Chromium | Only a bundled Chromium gives `session.fromPartition`, `ses.setProxy`, `webRequest` header control and CDP pre-navigation injection. Tauri's OS WebView cannot be partitioned this way. |
| Isolation on Android | **Java + Android WebView** in a dedicated `:profile` process | `WebView.setDataDirectorySuffix()` is called before any WebView exists in that process; the process is killed on exit so every profile gets a fresh data directory. |
| EXE ⇄ APK communication | **Supabase** Realtime + Postgres | Direct device-to-device traffic fails behind NAT, on changing mobile IPs and when one device is offline. Realtime carries commands; Postgres holds authoritative state behind RLS. |
| Hosted control plane | **Vercel** | SEO landing page, downloads, device dashboard, and the same React UI as a website. |
| Ship real binaries | **GitHub Actions** | This Linux sandbox has no JDK, Android SDK, Wine, X server or access to Electron release assets. CI has all of them. |

### Frameworks considered and rejected

- **Flutter / React Native** — no controllable browser engine; their WebView plugins cannot partition storage or override headers at the network layer.
- **Tauri** — uses the OS WebView (WebView2/WebKitGTK), so per-profile Chromium partitioning and CDP injection are unavailable.
- **Capacitor** alone — fine as a wrapper, but its stock WebView plugin gives no per-profile data dirs. We use the same idea with a custom native bridge instead.
- **Custom Chromium fork** — this is what AdsPower-tier stealth actually requires (see §6). Not feasible to build or verify in this environment; not claimed.

## 2. System topology

```
                         ┌──────────────────────────────┐
                         │  Vercel (Next-free static)   │
                         │  SEO site · control plane    │
                         └──────────────┬───────────────┘
                                        │ same React UI
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
┌───────▼────────┐            ┌────────▼─────────┐            ┌────────▼─────────┐
│ Electron (EXE) │            │ Supabase project │            │ Android (APK)    │
│ main / preload │◄──────────►│ Realtime · RLS   │◄──────────►│ MainActivity     │
│ REST :9333     │ broadcast  │ Postgres · Edge  │  PostgREST │ BrowserActivity  │
└───────┬────────┘  joe-sync  │ Functions        │   poll     └────────┬────────┘
        │                     └──────────────────┘                     │
        │ session.fromPartition + CDP inject          :profile process  │
        ▼                                                              ▼
   Chromium per profile                                     WebView per profile
   (cookies/cache/IP)                                       (data dir suffix)
```

Both apps hold the same `workspace.json` shape. The desktop app stores it in
Electron `userData`; the APK ships a generated copy in `assets/workspace.json`
and reads it through `window.JoeBridge.getProfiles()`. Both then persist local
edits to `localStorage`.

## 3. Profile isolation

### Desktop (`apps/desktop/main.js`)

1. `session.fromPartition('persist:' + profile.id)` — separate cookies, cache, localStorage, IndexedDB.
2. `ses.setProxy({ proxyRules })` — HTTP/HTTPS/SOCKS proxy bound to that session only.
3. `webRequest.onBeforeSendHeaders` — `User-Agent`, `Accept-Language`, `Sec-CH-UA-*`, `DNT`.
4. `webContents.debugger.attach('1.3')` + `Page.addScriptToEvaluateOnNewDocument` — injects `buildInjectionScript(spec)` into the **main world before any page script**, plus `Network.setUserAgentOverride` with matching `userAgentMetadata`.
5. `preload.js` exposes a whitelisted `window.joe` bridge; `rest.js` serves a loopback REST API at `127.0.0.1:9333`.

### Android (`apps/android/...`)

1. `MainActivity` writes the chosen profile id to `filesDir/profile_suffix.txt`, then starts `BrowserActivity` in the `:profile` process.
2. `BrowserActivity.attachBaseContext()` calls `WebView.setDataDirectorySuffix("joe_" + id)` before any WebView is created.
3. `onDestroy()` kills the process, guaranteeing a fresh data directory next time.
4. `WebSettings.setUserAgentString`, then `onPageStarted` / `onPageFinished` run the **same** generated injection script from `assets/injection/<id>.js`.
5. `SyncPoller` polls the Supabase `commands` table every 5 s and forwards commands to `window.__joeOnCommand` in the React UI.
6. `SyncHttp` posts commands from the APK back to the EXE via PostgREST.

**Known Android limitation:** WebView-level proxying needs `androidx.webkit.ProxyController`. To keep the APK build dependency-free (plain SDK + `aapt2`/`d8`), Android profiles use the device network; proxy routing on mobile is expected at the VPN/system level. This is documented rather than hidden.

## 4. Fingerprint consistency layer

`packages/core/src/devices.ts` defines 8 **coherent device templates**. Each
template is internally consistent (Windows UA ↔ D3D11 ANGLE renderer ↔ Win32
platform ↔ desktop screen; Android UA ↔ ARM GPU ↔ Linux armv8l ↔ phone viewport
↔ touch points). A generator never mixes random values, because modern engines
hash the *whole* fingerprint and compare it against real-device datasets — a
"Windows UA + Apple GPU + Bangladesh timezone + de-DE locale" profile is more
suspicious than an unmodified browser.

`createProfile()` adds region-matched locale selection, deterministic seeded
variation, Client Hints derived from the same Chrome major, and a per-profile
`noiseSeed`. `checkConsistency()` runs 24 checks and returns a score, grade and
actionable hints.

`packages/fingerprint/src/index.ts` builds one JS string that patches:
navigator (UA, platform, vendor, hardware, languages, plugins, `userAgentData`,
`webdriver`, DNT), screen/window geometry, `Intl.DateTimeFormat` +
`getTimezoneOffset`, canvas + audio noise, WebGL `getParameter`/`getExtension`,
WebRTC private-candidate stripping, media devices and speech voices, plus a
`Function.prototype.toString` mask for installed getters.

## 5. Data + sync

Migration: `supabase/migrations/0001_joe_browser_init.sql` (also applied to the
live project `rajxyaatbvlrxxzjntmo`). Tables: `workspaces`,
`workspace_members`, `profiles`, `proxies`, `devices`, `commands`, `events`.
All child tables are RLS-scoped to authenticated workspace members. Realtime
publication covers `commands`, `events` and `devices`. The Edge Function
`joe-command-validate` checks envelope shape, topics, devices, sequence and
payload size before fan-out.

`packages/sync/src/index.ts` defines `SyncTransport`, a loopback transport for
tests/live preview, a Supabase Realtime adapter, and `SyncClient` with topic
routing, directed messages, workspace isolation and bounded history.

## 6. The honest ceiling

Commercial "virtually undetectable" browsers patch the browser **engine**:

- Donut Browser → proprietary Wayfern Chromium fork, fingerprint set in C++.
- ShardBrowser → Chromium 157 patched for TLS/JA4, HTTP/3, WebGPU, Client Hints, font enumeration, V8/CDP side channels.
- Camoufox → Firefox C++ injection; its docs explicitly note JS injection is detectable.
- OVO Browser / Furi → source-level Chromium kernels.

Joe Browser **does not ship a patched engine**. It therefore cannot claim parity
with those products. Engine-level signals — TLS ClientHello / JA4, HTTP/2 frame
order, QUIC behaviour, font rasterisation, GPU driver behaviour, CDP detector
side channels — come from stock Chromium / Android WebView. The app labels these
surfaces as `engine` in the Fingerprints view and in the profile detail, and the
consistency checker calls them out. Building a real fork requires Chromium
source, a full C++ toolchain and hours of compile time per platform; it is
outside what this environment (or this project) can honestly deliver.

The project is built for legitimate privacy, QA/testing, ad verification and
separation of one's own accounts. It does not implement vendor-specific
anti-bot circumvention, ban evasion, CAPTCHA solving or mass-account tooling.

## 7. Environment constraints (verified in this sandbox)

| Capability | Here |
|---|---|
| Live React/Vite preview, typecheck, 18 unit/SSR tests, headless-Chromium UI tests, real screenshots | ✅ |
| Supabase migrations, Edge Functions, Vercel project + deploy via connectors | ✅ |
| GitHub Actions → Windows EXE + Android APK + GitHub Release | ✅ |
| Electron GUI, Xvfb, Wine, JDK, Android SDK, `dl.google.com`, Electron release assets, `uploads.github.com` | ❌ blocked locally; handled in CI |

The headless Chromium used for UI testing and screenshots comes from the npm
package `@sparticuz/chromium` (its NSS libs are extracted from
`bin/al2023.tar.br`); see `scripts/chromium.mjs`.

## 8. Build order

1. `npm test` / `npm run test:java` / `npm run build` — shared core + UI.
2. `npm run build:core` → `apps/desktop/core.cjs` (CommonJS bundle of the TS core).
3. `npm run build:android-ui` (Vite with `base: './'`) + `npm run build:assets` → APK `assets/` (React UI, `workspace.json`, per-profile injection scripts).
4. `npm run build:site` → static SEO site.
5. GitHub Actions `release.yml`: Windows `electron-builder`, Ubuntu `scripts/build-apk.sh`, then a Release with binaries + checksums.
