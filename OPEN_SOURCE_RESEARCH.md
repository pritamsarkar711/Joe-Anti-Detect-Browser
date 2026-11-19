# Engine research checkpoint

Existing project investigation: [prior art](docs/RESEARCH.md). No external code
imported or new engine chosen in this change. The first comparison should be
the bundled Electron runtime versus the system WebView: measure package size,
security update responsibility and supported storage partitions. Before
adopting CEF or GeckoView, record the specific upstream revision, license and
notices, latest security release, platform requirements, isolation API and a
compiled minimal integration. That upstream review remains outstanding.

## 2026-11-19 second checkpoint — control-plane libraries

| Library | Purpose | Version | License | Why |
|---|---|---|---|---|
| `@supabase/supabase-js` | Cloud auth, session persistence, entitlement reads, edge-function calls from web/desktop | ^2.119.2 (installed 2.119.2) | Apache-2.0 | The project's Supabase project is already the control plane (migrations, edge functions). Official client; no alternative auth backend introduced. Chosen over hand-rolled GoTrue fetch code for maintained token refresh and PKCE handling. |
| `lodash` / `lodash-es` (overrides → 4.18.1) | Transitive dev-toolchain dependency (vitest mocker, java-parser chain) | 4.18.1 override | MIT | Clears the audit advisory without touching `java-parser`'s pinned chevrotain 11.0.3 (chevrotain 13 breaks its API). |

Both were introduced to satisfy the "no cloud accounts" honesty fix (the
account screen previously faked Supabase) and the clean-audit requirement.
No engine selection (CEF, GeckoView, Playwright, puppeteer) changed.
