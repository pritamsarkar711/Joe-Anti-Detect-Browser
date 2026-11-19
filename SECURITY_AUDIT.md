# Security review — open findings

Root `npm audit` reported 11 affected package entries: 2 critical, 7 high, 2 moderate (includes transitive development tooling). Critical entries: tinypool and vitest. Upgrade and retest the toolchain, audit the separate desktop install, then assess shipped Electron/Chromium and WebView versions independently. No clean security sign-off.

Removed raw exception details from renderer startup/recovery and removed remote manager fallback. APK signing no longer uses a generated one-time release identity or traced shell commands. The workflow no longer posts raw APK logs to public issues. Do not supply private signing material through chat.

Unresolved: verify IPC sender/frame restrictions, privileged URL handling throughout both shells, authenticated REST, workspace credentials at rest, Android suffix failure handling, extension provenance and WebView bridge origins. Exercise RLS with two non-admin staging users and test server-side entitlements. No production service changes or account reads were necessary for this checkpoint.
