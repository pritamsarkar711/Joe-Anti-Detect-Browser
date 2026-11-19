# Joe Browser — proposed architecture (pre-requirements draft)

This is the stack I recommend for a profile-isolation browser that ships as a
Windows desktop app (`.exe`) and an Android app (`.apk`), with the two clients
kept in sync through Supabase and a Vercel control plane. It is a proposal, not
the final build — the full requirements will refine it.

## 1. Chosen language / framework

**TypeScript everywhere, with thin native shells.**

| Layer | Technology | Why |
|---|---|---|
| Shared logic | **TypeScript** (no DOM deps) | One profile/fingerprint/sync implementation compiled into both clients. Same language I can test here with Vitest. |
| Shared UI | **React 18 + Vite** | The control-plane UI is literally the same code inside Electron, inside the APK's WebView shell, and on Vercel. |
| Desktop | **Electron** (bundled Chromium) + `electron-builder` → `.exe` | Only a *bundled* Chromium gives per-profile `BrowserWindow`/`session` isolation, request-header control, proxy-per-session, and preload injection. Tauri uses the OS WebView, which cannot do this reliably. |
| Android | **Kotlin** native shell + Android `WebView` (+ a Capacitor-style bridge) | Electron does not exist on Android; a WebView with a JS bridge and per-profile data dirs is the practical equivalent. Kotlin gives control over UA, headers, cookie/storage partitioning, and JS injection before page load. |
| Sync / data | **Supabase**: Postgres + Auth + Realtime (broadcast/presence) + Storage + Edge Functions | Realtime is a WebSocket bus both clients can hold open; RLS-scoped tables store profiles, devices, commands, and audit events. |
| Control plane / API | **Next.js on Vercel** | Hosted dashboard, device management, webhooks, and download/update endpoints. Serverless routes validate and fan out commands. |
| Tests | Vitest (unit), Playwright (Electron E2E), Supertest/Node (API), Gradle `test` (Kotlin) | All of the JS/TS side is runnable in this sandbox. |
| Packaging | `electron-builder` (Windows runner) + Gradle/`assembleRelease` (Android runner) via **GitHub Actions** | The binaries are produced by CI, not by this Linux sandbox. |

## 2. How the EXE and APK actually communicate

They never talk to each other directly (NAT, offline devices, different
networks). Both connect to the same Supabase project:

```
EXE (Electron) ─┐                        ┌─ Vercel / Next.js dashboard
                ├─► Supabase Realtime ◄──┤
APK (Android)  ─┘   channel joe:<ws>     └─ Edge Functions (validation, fan-out)
                          │
                     Postgres (RLS)
                  profiles · devices · commands · events
```

- **Realtime broadcast** (`joe-sync`): low-latency commands — `command:launch`,
  `command:close`, `presence:heartbeat`, `profiles:reload`. See
  `src/core/sync.ts` for the transport interface and the exact adapter shape.
- **Postgres as truth**: profiles, revisions and device registry. Realtime is
  notification only; every client re-reads state after a command, so a missed
  message is recoverable.
- **Auth + RLS**: both apps sign in as the same workspace user; a device token
  is scoped to that workspace. No service-role key ever ships inside an APK/EXE.
- **Vercel**: the human-facing dashboard and the HTTP endpoints (device
  registration, update checks, audit). It writes to the same Supabase project —
  it is *not* a middleman for device-to-device traffic.
- **Supabase Storage**: encrypted profile bundles (cookies, localStorage) synced
  on demand, with the encryption key held on-device.

## 3. Profile isolation model

`src/core/profile.ts` shows the key idea: a profile is a **declaration** derived
deterministically from `name + workspace seed`. Because the derivation is a pure
FNV-1a hash over a fixed table of screens, timezones, locales and GPU strings,
V8 (desktop) and ART (Android) produce *identical* parameters from the same
seed. Each client then applies them with its own native mechanism:

- **Electron**: one `session.fromPartition('persist:' + profile.id)` per profile,
  `webRequest.onBeforeSendHeaders` for UA/Accept-Language, `ses.setProxy`, and a
  preload script injected with `contextIsolation` that patches the JS-visible
  fingerprint surface (canvas/audio/WebGL/screen/navigator) from `noiseSeed`.
- **Android**: one `WebView` data directory per profile, `WebSettings.userAgentString`,
  `shouldInterceptRequest` for header overrides, and the *same* JS payload injected
  via `evaluateJavascript` on `onPageStarted`.

Isolation (cookies, cache, localStorage, IP) is per profile; the fingerprint
surface is made consistent with the declared spec.

## 4. What this sandbox can and cannot do (verified)

| Capability | Here? |
|---|---|
| Run the React/Vite control-plane UI as a **live preview** (HTTP, proxied) | ✅ yes — `npm run dev`, host `0.0.0.0` |
| Typecheck, unit-test, build, find bugs, fix, re-run | ✅ yes — `npm test`, `npm run build` |
| Provision Supabase tables/migrations/Edge Functions, set Vercel env vars, deploy | ✅ yes — both connectors are enabled |
| Run the Electron app with a visible GUI | ❌ no X server / no Xvfb / no Chromium binary |
| Compile an APK | ❌ no JDK, no Android SDK, no Gradle, and `dl.google.com` (Android Maven) is blocked |
| Package an NSIS `.exe` | ❌ no Wine; portable targets can be emitted but not executed |
| Run an Android emulator / `adb` | ❌ no emulator, no KVM |

**Therefore:** binaries are produced by GitHub Actions (Windows runner for the
EXE, Ubuntu runner with Android SDK for the APK) from source I write and commit
here. I can fully verify the source, tests, the API, the database schema, the
Vercel deployment, and the live web/control-plane UI. I cannot click through a
desktop GUI or an emulator in this environment, and I will say so rather than
pretend otherwise.

## 5. Build order once requirements arrive

1. Lock the schema (`profiles`, `devices`, `commands`, `events`) + RLS policies via a Supabase migration.
2. Ship `packages/core` (profiles, fingerprint payloads, sync client) with unit tests.
3. Ship the shared React UI + Vercel control plane; deploy and hit the live URL.
4. Ship the Electron desktop shell; test the main process headlessly with Playwright + `electron` in CI.
5. Ship the Kotlin Android shell + WebView bridge; build the APK in CI.
6. Wire Realtime end-to-end: EXE → Supabase → APK, with a real device-loopback test.
7. GitHub Actions release workflow producing `.exe`, `.apk`, and SHA-256 checksums.

## 6. Scope note

I'll build profile isolation, privacy controls, and account separation for
legitimate uses (QA, testing, managing multiple own accounts, privacy research).
I won't implement features whose purpose is defrauding platforms, evading
enforcement/bans, or impersonating real people. If a requested feature falls in
that category, I'll flag it and suggest a legitimate alternative.
