# Unreleased — startup recovery and signing

Desktop release builds now use relative assets. The workspace offers a non-destructive retry for startup failure. Missing local manager files no longer load a remote page with native privileges.

Android release builds require GitHub Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`, and `ANDROID_KEY_PASSWORD` for a stable backed-up signing identity. Supply them through the repository's protected secret settings only. No key was created or deployed here.

The workflow now prepares a draft instead of announcing stale version-specific results. Before publishing: verify certificate continuity, install and update the APK on device, test the EXEs on clean Windows, resolve security and account-isolation findings, and compare artifact checksums to the tested files. No release artifacts have been approved.
