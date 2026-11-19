# Joe-Anti-Detect-Browser

Profile-isolation browser for **Windows desktop (EXE)** and **Android (APK)**,
kept in sync through **Supabase** with a **Vercel** control plane.

> **Status: pre-requirements capability proof.** This repo currently contains a
> runnable React + TypeScript control-plane prototype, the shared core modules,
> tests, and the proposed architecture. The Electron and Android shells are
> built after the full requirements are supplied. See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack (chosen)

- **TypeScript** shared core (profile model + transport-agnostic sync bus)
- **React 18 + Vite** — shared UI (control plane, and later embedded in both shells)
- **Electron** + `electron-builder` → desktop `.exe`
- **Kotlin / Android WebView** → `.apk`
- **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions) → EXE ⇄ APK
- **Next.js on Vercel** → hosted dashboard and HTTP API
- **GitHub Actions** → builds the `.exe` and `.apk` binaries (this Linux sandbox
  has no JDK/Android SDK/Wine/X display)

## Run locally

```bash
npm install
npm run dev      # live preview on 0.0.0.0:5173
npm test         # 11 headless tests (core + SSR UI smoke)
npm run build    # typecheck + production bundle
```

The live preview shows four deterministic profiles, both peers (EXE / APK), and
a realtime event log. Clicking **"EXE → APK · launch profile"** sends a command
through the sync bus and the Android peer ACKs it. The loopback transport used
in the preview is swappable for the Supabase Realtime adapter in
`src/core/sync.ts` (already implemented and unit-tested).

## Layout

```
src/core/profile.ts     deterministic, platform-agnostic fingerprint profile model
src/core/sync.ts        SyncClient + local + Supabase Realtime transports
src/core/sync.test.ts   EXE ⇄ APK routing, delivery, history, wire-format tests
src/App.tsx             control-plane UI (profiles / peers / event log)
src/App.ssr.test.tsx    headless render smoke test
docs/ARCHITECTURE.md    full proposed design, capability limits, build order
```
