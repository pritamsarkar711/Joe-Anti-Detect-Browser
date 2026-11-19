# Engine decision checkpoint

Existing prior-art inventory: [docs/RESEARCH.md](docs/RESEARCH.md). This change reuses the existing Electron, React and Playwright plumbing. No external engine code was imported. Android WebView is platform-managed; a viewport preset cannot supply Gecko. Before selecting GeckoView, CEF or a fixed WebView2 distribution, review upstream maintenance, runtime update policy, redistributable licenses (including bundled codecs), package size and isolated storage APIs. No new candidate has completed that review in this checkpoint.
