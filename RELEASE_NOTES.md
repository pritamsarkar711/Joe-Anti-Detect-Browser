# Unreleased — startup and signing checkpoint

Retry loading the workspace without clearing profiles when the entry script or application chunk fails. No new installer or APK is published.

For maintainers: configure repository signing secrets `JOE_SIGNING_STORE_B64` (base64-encoded keystore), `JOE_SIGNING_ALIAS`, `JOE_STORE_PASSWORD`, and `JOE_KEY_PASSWORD` through the CI secret store, not in source or chat. Preserve and back up the same signing identity across releases. Before distribution compare the APK signer certificate against the owner's trusted fingerprint, then test a clean install and in-place upgrade. Signature verification alone is not an installation test.
