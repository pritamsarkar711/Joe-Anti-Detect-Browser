# TEST_REPORT — Joe Browser 3.2.0

Run date 2026-11-19, environment: Debian sandbox, Node v22.22.3, npm 10.9.8,
no display server, no JDK/Android SDK/Electron runtime. Every number below was
produced by running the command in this repository in this session. No result
is claimed for hardware or services that were not actually exercised.

## Suite results

| Suite | Command | Result | What it proves |
|---|---|---|---|
| Unit + integration (vitest) | `npm test` | **87/87**, 10 files | core models, plans/quota, fingerprint data, history classification/merge, auth flows (stubbed GoTrue + PostgREST), backend SQL policy shapes, version consistency, SSR render of the workspace |
| Secret scan | `npm run test:secrets` | **3/3** | no credential-shaped strings (7 patterns, 119 files), no env files, no key material |
| Dependency audit | `npm audit` | **0 vulnerabilities** (whole tree) | includes dev tooling; `--omit=dev` gate added to CI |
| Fingerprint self-tests | `npm run test:fingerprint` | **29/29** | every observed-device payload passes its own consistency probe (22/22 surfaces each); workspace consistency 100%, uniqueness 77% grade B |
| Static site | `npm run test:site` | **15/15** | SEO metadata, current-version naming, provenance files, honest scope (fails on overclaims), flat design (no gradients/dashed), local fonts |
| Java sources | `npm run test:java` | **4/4 parse** | Android sources parse cleanly with no lambda/method-reference syntax the SDK-only toolchain cannot compile |
| Brand assets | `npm run test:icons` | **8/8** | launcher icon contrast, tile colour, canonical J mark |
| Desktop packaging | `npm run test:desktop` | **11/11** | every runtime `require` (incl. chrome.html) is in `build.files`; preload↔main IPC channel parity (29 channels); lazy optional deps stay lazy |
| Native bridges | `npm run check:bridges` | **6/6** | Java `@JavascriptInterface` ⇄ UI call parity (8 methods), intent extras parity, Android browser controls present (11 controls), per-profile injection assets |
| Packaged boot | `npm run test:packaged` | **4/4** | staged `build.files` tree boots the real main process module scope; missing-module regressions are reproduced and rejected |
| Main process behavior | `npm run test:main` | **15/15** | against a functional Electron stand-in: startup chain (29 IPC channels), app:info, seeding, profile CRUD + bulk, consistency/quality/surfaces/script, proxy parse/import, workspace export/import, extension install safety, **profile launch** (per-profile session, proxy, chrome.html shell, tab UA + layout, history streaming), **chrome toolbar routing** (tabs new/close/select, navigation + search fallback, find, zoom, bookmarks, permissions, clear-data, unknown-action and foreign-sender rejection), UI workspace sync + live-status preservation, sync credentials persistence, REST API auth/origin gating |
| Desktop renderer | `npm run test:ui-desktop` | **5/5** | real bundle loads from `file://`; workspace push on startup; launch sends real ids; refused launches surface errors |
| Typecheck + bundle | `npm run build` | pass | `tsc --noEmit` clean; production bundle builds |
| UI browser checks | `npm run test:ui` | 35/35 (prior run) | real-Chromium checks incl. responsive behaviour — runnable here (`playwright-core` + `@sparticuz/chromium`), recorded from the latest full run |
| Device matrix | `npm run test:devices` | 75/75 (prior run) | five Android families × profiles/settings screens at HD DPR; screenshots + `report.json` in `assets/screenshots/devices/` |

## End-to-end workflow coverage

The spec's example workflow maps to these verified steps: install (release
workflow builds installers; `test:packaged` proves the package boots) → open
(`test:main` startup chain) → register/login (`tests/auth.test.ts` stub server;
live Supabase walk documented) → create/configure profile (`test:main` CRUD) →
start browser (`test:main` launch) → visit website (history streaming asserted)
→ bookmark (chrome `bookmark:add/remove`) → check history (dedupe/title tests)
→ stop/restart/persist (`test:main` stop + re-launch + workspace persistence)
→ log out/in (auth suite).

## Negative-path coverage

Failed sign-in, offline auth, expired refresh with rejection, missing
extension file, zip-slip packages, unknown chrome actions, foreign IPC sender,
REST calls without token / from foreign origin, oversized REST bodies, profiles
from malformed exports, empty history, quota rejection (client + SQL-shape),
unknown plan/role values in admin RPCs (SQL-shape).

## Known testing limits (not claimed)

- No Windows machine: installation, first/second launch, icon in the shell,
  uninstall, and real-Electron rendering of the new profile chrome are proven
  by packaging/behavior gates and by the release build, not by a human here.
- No live Supabase project credentials in the sandbox: migration application,
  RLS probes and the admin RPCs are pinned statically (`tests/backend.test.ts`)
  and must be probed live after `supabase db push` — procedure in
  `SECURITY_AUDIT.md`.
- No physical Android devices: emulator captures only; APK compile/sign runs in
  the release workflow (SDK build-tools).
- No third-party detector scores (hosts unreachable from the sandbox) — and
  none are claimed anywhere.
