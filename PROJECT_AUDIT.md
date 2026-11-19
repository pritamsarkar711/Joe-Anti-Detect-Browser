# Release decision: hold (2026-11-19)

First checkpoint on base `9302a80`. The release job sent the web build to Electron even though its manager calls `loadFile`. A web entry starting `/assets/` resolves at the filesystem root there. This explains a startup failure without attributing all reported freezes to the same cause. The job now transfers the desktop build; both native UI outputs were inspected. The missing-bundle recovery test runs independently of Electron.

The repository contains three distinct clients: a React/Vite workspace, a Node/Electron shell and Java activities with platform WebView. `site/` is a separate marketing site. The Android build invokes SDK tools directly, not Gradle. Shared core configuration is not a browser engine, a security boundary or proof of device compatibility. Local SSR, syntax, and stubbed main-process checks cannot verify an installation.

[Phase tracker](REQUIREMENTS_TRACKER.md) · [Bugs](BUG_REPORT.md) · [Test evidence](TEST_REPORT.md) · [Security](SECURITY_AUDIT.md) · [Research](OPEN_SOURCE_RESEARCH.md) · [Release handoff](RELEASE_NOTES.md). Detailed control-by-control inventory and native acceptance remain outstanding.
