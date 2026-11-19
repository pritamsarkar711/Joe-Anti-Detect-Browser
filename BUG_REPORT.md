# Findings

- **Startup:** If the entry script itself fails, its catch handler cannot run. The static shell previously offered no action. A plain HTML retry link works before JavaScript starts; the lazy-import failure screen now also offers a non-destructive retry. Tested in Chromium, not a diagnosis of all reported native freezes.
- **APK updates:** Each previous build generated a different signing identity. Android requires a compatible signer for an in-place update. The release script now requires a stable externally managed store. Past installations signed with unavailable keys may not be upgradable; do not suggest uninstalling without warning about data loss.
- **Proxy status (open):** scripts/generate-android-assets.mjs seeds documentation-range proxy addresses with successful status and latency without a connection test. Separate demo data from production first-run state and verify clean install shows no invented measurements.
