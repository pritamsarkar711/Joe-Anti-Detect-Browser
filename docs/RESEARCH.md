# Prior art and resources

What already exists in the open-source anti-detect space, what this project took
from it, and what it deliberately did not. Every repository listed here was
checked against the GitHub API while writing this document; star counts and
licences are as measured on 2026-11-19 and will drift.

The point of this page is not to list links. It is to record **which layer each
project operates at**, because that is what decides whether its technique can be
reused by a project that does not ship a patched browser engine.

## The layer model

Browser fingerprinting surfaces are exposed at four distinct layers. A project's
whole architecture follows from which layer it chose.

| Layer | Surface | Who controls it | Changeable from JavaScript? |
| --- | --- | --- | --- |
| L1 — Network | TLS ClientHello/JA3/JA4, HTTP/2 frame order and priority, QUIC, TCP/IP stack | The socket library / OS kernel | **No** |
| L2 — Engine | Canvas rasterisation, WebGL driver strings and shader precision, font metrics, audio DSP, `navigator.*` getters backed by C++ | The engine binary | Only by patching or shimming the engine |
| L3 — Document | Scripted `navigator`, `screen`, WebGL strings, canvas noise, `Intl` locale, timezone, media devices | The page's own JS, before other scripts run | **Yes**, reliably |
| L4 — Behaviour | Mouse paths, keystroke timing, scroll physics, focus order | Injected automation | Yes, but detectable if poorly done |

Detectors weigh layers differently, but the highest-signal signals at scale are
L1 network and L2 engine: a coherent L3 story on top of an incoherent L1
handshake is still incoherent.

**Joe Browser operates at L3, plus per-profile isolation at the Electron/WebView
container level.** That is a deliberate, stated boundary, not an oversight. Every
claim in this repository is scoped to it.

## Projects surveyed

### L1 + L2 — patched engines

| Project | ★ | Licence | What it does | What we took |
| --- | --- | --- | --- | --- |
| [`daijro/camoufox`](https://github.com/daijro/camoufox) | 13.4k | MPL-2.0 | Firefox rebuilt with fingerprint surfaces moved into C++, so they are consistent at the engine level rather than shimmed in JS | The **coherence principle**: one device description drives every surface. Not the code, and not a claim of parity — we run no patched build |
| [`adryfish/fingerprint-chromium`](https://github.com/adryfish/fingerprint-chromium) | 3.3k | BSD-3-Clause | Ungoogled Chromium fork exposing `--fingerprint*` switches for canvas, WebGL, audio, fonts, timezone | The **switch taxonomy**: which surfaces are worth parameterising per profile. We parameterise the L3 subset only |
| [`ultrafunkamsterdam/undetected-chromedriver`](https://github.com/ultrafunkamsterdam/undetected-chromedriver) | 12.9k | GPL-3.0 | Patches ChromeDriver's `cdc_` markers and CDP exposure | Nothing (GPL is incompatible with this MIT project). Useful as a **negative** reference: CDP presence is an L2 signal that script cannot hide |
| [`lwthiker/curl-impersonate`](https://github.com/lwthiker/curl-impersonate) | 7.2k | MIT | Rebuilds curl with Chrome/Firefox's exact TLS and HTTP/2 fingerprints | Nothing, but it is the clearest demonstration of why **L1 cannot be fixed from L3**: you have to change the socket library |

### L3 — scripted surfaces

| Project | ★ | Licence | What it does | What we took |
| --- | --- | --- | --- | --- |
| [`apify/fingerprint-suite`](https://github.com/apify/fingerprint-suite) | 2.7k | Apache-2.0 | Generates headers, Client Hints and injection scripts from one device model | The **one-model-drives-all-surfaces** architecture, which this project uses directly. Its observed-device data is the provenance of our device presets (Apache-2.0, attributed in `NOTICE`) |
| [`berstend/puppeteer-extra`](https://github.com/berstend/puppeteer-extra) | 7.4k | MIT | Plugin framework for stealth patches on Puppeteer | The **patch-ordering discipline**: shim before any page script runs, and never leave a detectable own-property behind |

### Measurement — how any of this gets verified

| Project | ★ | Licence | What it is | How we use it |
| --- | --- | --- | --- | --- |
| [`fingerprintjs/fingerprintjs`](https://github.com/fingerprintjs/fingerprintjs) | 28.8k | MIT | Open-source browser fingerprinting library | Read for what it collects; **not** bundled, because shipping a fingerprinter contradicts the no-telemetry rule |
| [`abrahamjuliot/creepjs`](https://github.com/abrahamjuliot/creepjs) | 2.6k | MIT | Lies/trust-score detector aimed at anti-detect browsers | Read as the specification for what to make coherent. Its output is the shape of our local probe's 22 checks |
| [`cloudflare/cloudflare-docs`](https://github.com/cloudflare/cloudflare-docs) | 5.5k | CC-BY-4.0 | Documents how bot scores are built | Cited for the L1 weighting claim. Not copied |

### Data sources

| Source | Licence | Use |
| --- | --- | --- |
| [Apify `fingerprint-suite`](https://github.com/apify/fingerprint-suite) device data | Apache-2.0 | Observed-device presets, filtered for internal coherence |
| [BrowserForge](https://github.com/daijro/browserforge) generated headers | MIT | Header ordering and Client Hints brand lists |
| [MDN browser-compat-data](https://github.com/mdn/browser-compat-data) | CC0-1.0 | Which `navigator` members exist per engine and version |
| [simple-icons](https://github.com/simple-icons/simple-icons) | CC0-1.0 | Official brand marks. Edge was removed from v16, so its geometry is pinned from v11.14.0 in `scripts/generate-brand-assets.mjs` |
| [UA-CH spec](https://wicg.github.io/ua-client-hints/) | W3C | The only correct source for Client Hints shape and ordering |

## What this project does not, and will not, claim

- **No patched Chromium or Firefox kernel.** TLS/JA4, HTTP/2 framing, QUIC, font
  rasterisation, GPU driver behaviour and CDP side channels are engine- or
  network-level and remain whatever the bundled engine produces.
- **No "undetectable" claim.** Coherence at L3 is achievable and is what the
  app measures. An L3-coherent profile can still be flagged on L1 reputation.
- **No third-party detector score.** Detector hosts are not reachable from the
  build sandbox, so no score is displayed, implied or hard-coded. `Leak check`
  runs our own probe locally and labels every result as such.
- **No telemetry.** Nothing is collected, which is also why `fingerprintjs` is
  read rather than shipped.

## Where the techniques landed in this codebase

| Technique | Origin | File |
| --- | --- | --- |
| One device model drives UA, Client Hints, GPU, screen, fonts, locale, touch | fingerprint-suite | `packages/core/src/profile.ts`, `packages/fingerprint/src/index.ts` |
| Client Hints stripped for WebKit/Gecko, kept for Chromium | UA-CH spec + observed behaviour | `packages/fingerprint/src/index.ts`, `apps/desktop/main.js` |
| Hardware drawn in ordered pairs (cores ↔ memory) so they never contradict | camoufox coherence principle | `packages/core/src/devices.ts` |
| Timezone/locale pinned to the proxy's country | fingerprint-chromium switch taxonomy | `packages/core/src/geo.ts` |
| 22 local consistency checks, reported with their own limits | creepjs trust surface | `packages/core/src/consistency.ts` |
| Injection ordered before page scripts, idempotent if re-run | puppeteer-extra patch-ordering | `apps/desktop/main.js`, `BrowserActivity.java` |

## Reading order

For someone continuing this work:

1. `docs/ARCHITECTURE.md` — how the four layers map onto this codebase.
2. This file — why the L3 boundary is where it is.
3. `docs/VALIDATION.md` — what is actually tested, and what is not claimed.
