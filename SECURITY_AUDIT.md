# Security checkpoint — not clearance to release

Root lockfile `npm audit` reported 11 affected package entries: 2 critical, 7 high, 2 moderate. Critical entries were vitest and tinypool. Counts include tooling and transitive entries, not eleven proven runtime vulnerabilities. Resolve and re-test the toolchain; independently audit packaged Electron/Chromium and Android WebView support. The nested desktop manifest is outside the root lockfile.

Removed shell tracing and automatic posting of Android signing logs to public issues. Startup import failures now emit a fixed event rather than exception contents. This is not a full log/secret scan. RLS, native navigation/IPC sender checks, Android bridge origin restrictions and subscription enforcement still require independent verification. No production database changes performed.
