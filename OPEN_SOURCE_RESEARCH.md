# Open-source research — components considered for 3.2.0

`docs/RESEARCH.md` already contains the fingerprinting survey (layer model,
patched-engine projects, measurement services) and records what this project took
from each. This file covers the research needed for **this** release: account
authentication, server-side authorization, and test infrastructure.

Rule applied throughout: a component is only reused if its licence is compatible
with this project's MIT source grant, it is maintained, and it can be integrated
without handing a credential or a network layer to an untrusted party.

Licences below are as declared by the upstream repository at review time. Star
counts, commit dates and release tags drift, so they are deliberately not quoted;
re-check before a future integration decision.

---

## 1. Authentication and authorization

| Component | Licence | What it provides | Decision |
|---|---|---|---|
| [`supabase/supabase-js`](https://github.com/supabase/supabase-js) | MIT | PostgREST + GoTrue + Realtime client | Used **inside the Electron main process only** (already a dependency there) for Realtime. For renderer authentication it was **not** added: a ~40 KB dependency for five endpoints, and the browser/WebView builds would carry it too. `src/state/cloud.ts` implements the same five calls with `fetch` and no dependency (≈300 lines including error mapping). Revisit if session management grows (OAuth providers, MFA). |
| [`supabase/gotrue`](https://github.com/supabase/auth) | MIT | The auth service the client speaks to | Not vendored. Studied for the exact request/response shapes: `grant_type=password`, `refresh_token`, `/recover`, `error_description` vs `msg`, and the fact that signup may return a user with no session when confirmation is required. Those behaviours are encoded in the client and its tests. |
| [`supabase/supabase-js`](https://github.com/supabase/supabase-js) | Apache-2.0 | Official Supabase client (GoTrue + Realtime) | Kept for the desktop shell's lazy Realtime connection (`apps/desktop/main.js`, declared in `apps/desktop/package.json`; the root copy satisfies local resolution). The account client itself is deliberately dependency-free `fetch` (`src/state/cloud.ts`) so the same code runs in the browser, Electron and the WebView without a bundler shim. |
| [`PostgREST/postgrest`](https://github.com/PostgREST/postgrest) | MIT | REST over Postgres, RPC by function name | Not vendored. Its RPC convention (`POST /rest/v1/rpc/<fn>`) informed the licensing `msap_*` RPCs captured from the live project; the app's own entitlement read is a plain row read (`GET /rest/v1/accounts`) scoped by RLS, and relay writes go through the edge function instead of table RPCs. |
| [PostgreSQL RLS documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | PostgreSQL licence (permissive) | The policy semantics relied on | Read, not copied. Drove three decisions: policies must be `FOR ALL` with both `USIng` and `WITH CHECK` for writes; `SECURITY DEFINER` functions need `set search_path`; and `revoke all … from public` is required before granting execute, because functions are executable by `PUBLIC` by default. |
| [`supabase/cli`](https://github.com/supabase/cli) | Apache-2.0 | Migration tooling (`supabase db push`) | Referenced in the README as one of two ways to apply the migrations. Not vendored. |

**Rejected:** rolling our own password store (would put credentials and hashing in
a client app); any "auth" library that keeps the identity in `localStorage` without
a server proof (that is exactly the defect this release removes); and using a
service-role key anywhere in a renderer to "simplify" RLS (it would hand every
install full database access).

## 2. Browser engine and profile isolation

Already surveyed in `docs/RESEARCH.md`; the decision for this release is unchanged
and worth restating because of the corrected marketing claim:

| Option | Licence | Why not adopted now |
|---|---|---|
| [`chromiumembedded/cef`](https://github.com/chromiumembedded/cef) | BSD-3-Clause | Would give a redistributable Chromium with more control than Electron, but adds a ~150 MB runtime per platform and a C++ build pipeline — and it is still Chromium, so it does not create a second engine. |
| [`mozilla/geckoview`](https://github.com/mozilla/geckoview) | MPL-2.0 | The only realistic way to offer a genuine Firefox identity on Android. Not integrated: no Android toolchain here, and an untested engine path would be a claim, not a feature. Firefox is therefore **not offered** and the picker says why. |
| [`microsoft/WebView2`](https://learn.microsoft.com/microsoft-edge/webview2/) | Proprietary (redistributable runtime) | Would remove the Electron dependency on Windows; also Chromium, so no engine gain. |
| [`electron/electron`](https://github.com/electron/electron) | MIT | Current desktop runtime. Kept: `session.fromPartition`, `setProxy`, `webRequest` and CDP injection give everything the product needs, and the isolation model is well understood. |

## 3. Testing and verification

| Component | Licence | Use |
|---|---|---|
| [`microsoft/playwright-core`](https://github.com/microsoft/playwright) | Apache-2.0 | Already a dev dependency; drives the UI, device and screenshot suites. Kept as `-core` (no bundled browsers) and paired with `@sparticuz/chromium`. |
| [`Sparticuz/chromium`](https://github.com/Sparticuz/chromium) | MIT | Supplies the headless Chromium binary in CI/containers. |
| [`vitest`](https://github.com/vitest-dev/vitest) | MIT | Unit + SSR tests, including the new schema and auth-client suites. |
| [`electron/asar`](https://github.com/electron/asar) | MIT | Packaging inspection. `scripts/check-asar.mjs` reads the archive header directly so the release job has no dependency at that step. |
| [`taplo`](https://github.com/tamasfe/taplo) / SQL linters | MIT | **Not adopted.** There is no linter for the specific invariants this project needs (no permissive policy, definer + revoke), so `tests/schema.test.ts` asserts them directly against the migration text and runs in the normal test suite. |

## 4. Explicitly not reused

| Project | Licence | Why not |
|---|---|---|
| [`ultrafunkamsterdam/undetected-chromedriver`](https://github.com/ultrafunkamsterdam/undetected-chromedriver) | GPL-3.0 | Incompatible with this project's MIT grant; also stealth-automation functionality outside the stated scope. |
| [`gorhill/uBlock Origin`](https://github.com/gorhill/uBlock) | GPL-3.0 | Cannot be bundled into an MIT application. The app links to the official store listing instead and installs only what the user chooses. |
| `Donut`, `ShardBrowser`, `Camoufox`, `OVO`-class projects | mixed (MPL/GPL/proprietary) | Patch the engine at C++ level, which this project explicitly does not do; some licences are incompatible. Referenced as prior art only. |
| [`apify/fingerprint-suite`](https://github.com/apify/fingerprint-suite) dataset | Apache-2.0 | **Already used** for the observed-device presets, with attribution in `NOTICE`. No new extraction was needed. |

## 5. Brand and font assets

| Asset | Licence | Handling |
|---|---|---|
| Platform marks (`windows`, `android`, `chrome`, `edge`, `brave`, `firefox`, …) | Trademarks; SVG paths from `simple-icons` (CC0) | Shipped locally as identification only; `TRADEMARK.md` states no ownership and no endorsement. |
| IBM Plex Sans | SIL OFL 1.1 | Bundled through `@fontsource/ibm-plex-sans`; attribution in `NOTICE`. |
| Country flags | MIT (`flag-icons`) | Inlined as data URIs at build time; no stylesheet dependency. |
| Material UI / icons | MIT | Unmodified dependency. |

## 6. What the research changed in this release

1. **Auth was implemented directly against the documented GoTrue/PostgREST
   contracts** instead of adding a client library — smaller surface, no new
   dependency in three runtimes, and every failure branch is testable.
2. **The "five engines" claim was removed.** Research confirmed that only
   GeckoView (or a patched Gecko) can honestly back a Firefox identity, and that
   Chromium/Edge/Brave identities are legitimately compatible with the bundled
   engine. The product now says exactly that.
3. **No engine-level patching was attempted**, consistent with the L3 boundary in
   `docs/RESEARCH.md`; the release notes keep the limitation explicit.
## 7. Component evaluations (merged research thread)

A parallel evaluation reached compatible conclusions and covered these
additional candidates. Method: official repository → license file → activity →
dependency audit (`npm audit`, `npm ls`) → role fit → copyleft compatibility
with MIT + CC BY-ND docs → advisory history.

| Project | License | Decision | Why |
|---|---|---|---|
| `@fontsource/ibm-plex-sans` | MIT (font: SIL OFL) | **Adopt** | Spec: IBM Plex Sans, self-hosted; no font CDN (`test:site` enforces) |
| `flag-icons` | MIT | **Adopt** | Circular country flags as data URIs, zero runtime stylesheet |
| `simple-icons` | CC0-1.6 | **Adopt** | Official brand marks only; nominative use stated in `TRADEMARK.md` |
| `java-parser` | MIT (deps chevrotain, lodash) | **Adopt, CI-only, overridden** | Parses first-party Android sources in CI; never shipped; lodash lifted to 4.18.1 via `overrides` |
| `playwright-core` + `@sparticuz/chromium` | Apache-2.0 | **Adopt, dev-only** | Real-browser UI/device tests and screenshots in CI |
| `@electron/asar` | MIT | **Reference only** | `scripts/check-asar.mjs` reads archive headers dependency-free instead |
| `vite-node` | MIT | **Adopt, dev-only** | Runs the fingerprint self-test script; pinned explicitly (vitest 5 no longer bundles it) |
| CEF | BSD-3 | Not adopted | ~200 MB + C++ toolchain; Electron embeds the same engine class |
| GeckoView | MPL-2.0 | Not adopted | The legal path to real Firefox-family engines on Android; needs a Gradle/AAR toolchain this SDK-only build cannot carry. Documented upgrade path (file-level copyleft is compatible with MIT distribution of separate files) |
| Camoufox / patching approaches | various | Not adopted | Engine patching is out of scope and contradicts the no-spoofing rule |
| uBlock Origin (vendored) | GPLv3 | Not adopted | GPL vendoring into an MIT app creates license coupling; the catalog links to official stores instead |
| `electron-updater` | MIT | Not adopted | No signing/publishing infrastructure operated yet; releases are explicit downloads with `SHA256SUMS.txt` |
