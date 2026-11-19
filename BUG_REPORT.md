# Startup and packaging findings

- **Wrong renderer artifact:** release pipeline fed the absolute-base web index to a file-based desktop shell. Corrected artifact selection; Windows install retest outstanding.
- **Entry bundle unavailable:** the boot catch itself lived inside the missing bundle. The static document now offers retry after ten seconds. A failed dynamic import offers retry immediately. Reload does not delete local data.
- **Unsafe recovery:** missing manager HTML fell back to a network page with native preload. Now only the installed document is loaded; a native retry/close dialog handles failure. Verify this dialog on Windows by removing the staged index in a disposable installation.
- **Misleading reset:** reset removed persisted workspace data, not just a visual cache. Clarified warning and added confirmation. Render errors no longer print exception content.
- **APK update identity:** fresh signing key per build prevented update continuity. Signing now requires a persistent owner-controlled keystore. Updates over old ephemeral signatures require the original key; do not advise uninstall without a data backup.
- **Open:** Android suffix initialization catches errors and falls back to default state in some paths. Do not certify profile isolation until switching and failure cases fail closed on device.
