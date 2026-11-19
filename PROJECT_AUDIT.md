# Joe Browser release audit · 2026-11-19

**Decision: hold release.** This first checkpoint tests renderer recovery, not native app stability. See [requirements](REQUIREMENTS_TRACKER.md), [bugs](BUG_REPORT.md), [tests](TEST_REPORT.md), [security](SECURITY_AUDIT.md), [research](OPEN_SOURCE_RESEARCH.md) and [release notes](RELEASE_NOTES.md).

The workspace has three separate delivery paths: Vite builds a React/MUI interface, Electron packages it with the desktop main process and preload bridge, and Android packages a local asset bundle for MainActivity and a separate BrowserActivity. The Android build invokes SDK tools directly, not Gradle. The `site/` presentation site is not the native renderer. A green web build cannot validate native asset paths, APK upgrades or Windows process cleanup.

Resume with clean-install and offline relaunch tests on the packaged shells. Capture the startup stage and outcome, not visited URLs, tokens or profile contents. Reproduce the reported freezes before changing GPU defaults. Then test two profiles and two accounts with distinct sentinel records before asserting isolation or rolling out database changes.
