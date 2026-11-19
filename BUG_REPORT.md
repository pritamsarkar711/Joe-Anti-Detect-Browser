# BUG_REPORT — Joe Browser

Every defect found by inspection or tests, with root cause, fix and the gate
that keeps it fixed. Historical 3.1.x bugs are kept for context; they were
verified fixed during this audit.

## Fixed in 3.2.0 (this audit)

### B-1 · History recorded nothing (functional lie in a shipped feature)
- **Severity: major.** The History view could list, filter and clear entries,
  but `addHistory` had **zero callers** anywhere in the codebase. The view
  showed three seeded demo rows forever while the product promised "every URL
  and search".
- **Root cause:** the recorder side was never written; only the display side.
- **Fix:** desktop `attachHistory` streams main-frame navigations to the
  manager (`history:entry`, title refresh on `did-finish-load`); Android
  `BrowserActivity` appends per-profile JSONL served through `JoeBridge`;
  `packages/core/src/history.ts` owns classification, deterministic ids and
  merge. Store merges via `mergeHistory`.
- **Gate:** `tests/history.test.ts`, `test:main` (navigation → entries),
  `check:bridges` (bridge methods exist on both sides).

### B-2 · Cloud auth was a facade
- **Severity: major.** AuthView's "cloud mode" accepted a password, then
  called the local email binder. The UI claimed "Accounts are handled by your
  Supabase project"; no Supabase auth call existed in the web/desktop bundle.
- **Fix:** `src/state/supabaseAuth.ts` — real GoTrue flows (sign-up with
  confirmation handling, sign-in, refresh-once, logout, recovery, password
  change) + `user_entitlements` lookup over PostgREST; store adopts the
  server's plan/role; AuthView awaits real results and shows server errors.
- **Gate:** `tests/auth.test.ts` (15 tests against a stubbed fetch server).

### B-3 · Browsed pages inherited the full management IPC bridge (security)
- **Severity: critical.** `preload.js` was attached to profile windows whose
  webContents browsed the open web. Any site could call `window.joe.workspace.
  replace()`, `profiles.delete()`, `sync.configure()` — full workspace control
  from a hostile page.
- **Fix:** tabs browse in WebContentsViews **without** a preload; the bridge is
  exposed only to bundled pages (`file:`) and localhost dev servers; the remote
  control-plane fallback gets nothing. Additionally the Android manager
  WebView (which carries `JoeBridge`) now refuses navigation away from its
  bundled assets and opens external links outside the app.
- **Gate:** `test:main` rejects foreign chrome senders; preload trust gate;
  inspection.

### B-4 · Plans/admin enforced only in client code
- **Severity: major (spec violation).** Quota and the admin role lived in
  TypeScript only; a modified binary could ignore both.
- **Fix:** migration `0002_auth_plans_admin.sql`: `user_entitlements` with
  RLS (no client writes possible), quota trigger on insert and workspace-move,
  `can_create_profile` RPC, `is_admin()` + ADMIN_ONLY admin RPCs, signup
  provisioning with per-user workspaces.
- **Gate:** `tests/backend.test.ts` pins policy shapes and SQL⇄core constants.

### B-5 · Version drift across surfaces
- **Severity: minor.** `main.js` reported `APP_VERSION = '3.1.0'` after the
  3.1.1 bump; Android's manager UA hard-coded `JoeBrowser/3.0`; `getDeviceInfo`
  reported `2.0.0`; the site build embedded a dead branch name
  (`arena/b5fe5e24-…`) as provenance.
- **Fix:** all derive from package.json / manifest / git; `tests/version.test.ts`
  locks every surface and forbids hard-coded literals.

### B-6 · "Unlock Premium" flipped a flag with no payment
- **Severity: minor (honesty).** A button labelled "Unlock Premium" silently
  set the local plan, implying a purchase that never happened.
- **Fix:** relabelled "Preview Premium" with explicit "no payment provider is
  connected — never charges" copy. No payment UI exists, per spec.

### B-7 · `DEMO_PROFILE_LIMIT` missing from core exports
- **Severity: minor.** Found by the new backend test: `plans.ts` exported it
  but `index.ts` did not re-export, so consumers saw `undefined`.
- **Fix:** re-exported; the backend policy test now imports it.

### B-8 · Stale toolchain advisories (dev deps)
- **Severity: moderate/high (dev-only).** `npm audit` reported 11 issues
  (vitest mocker/tinypool RCE-class, esbuild dev-server origin bypass, lodash
  via java-parser).
- **Fix:** vitest 5, esbuild 0.28, lodash/lodash-es 4.18 overrides,
  `vite-node` pinned explicitly. `npm audit` is now 0 tree-wide; CI enforces
  `npm audit --omit=dev --audit-level=high`.

## Historical (3.1.x), verified fixed during this audit

- **B-H1 (3.1.0, critical):** installer omitted `extensions.cjs` →
  `Cannot find module` before first paint. Fixed in 3.1.1 (allowlist +
  `check-desktop`/`check-packaged` gates that reproduce the failure). Verified:
  gates fail when the entry is removed.
- **B-H2:** UI and shell kept separate profile lists → every UI launch failed
  "Unknown profile" while the row showed running. Fixed via `workspace:replace`
  mirroring; verified in `test:main`.
- **B-H3:** Android launcher icon white-on-white; splash blank. Fixed with
  real vector marks; `test:icons` guards.
- **B-H4:** Supabase settings typed into Settings never reached the shell or
  the phone poller. Fixed (`sync:configure`, `saveConfig` bridge).
- **B-H5:** profiles from older exports crashed on missing `screen`. Fixed with
  fallbacks; verified in `test:main` seeded profiles path.
