#!/usr/bin/env bash
# Build a real, signed APK without Gradle or Maven dependencies.
# Uses only the Android SDK build-tools + JDK that ship on GitHub Actions runners.
set -euo pipefail

umask 077
SIGNING_MODE="release"
if [ -z "${JOE_SIGNING_STORE_B64:-}" ]; then
  if [ "${JOE_SIGNING_ALLOW_EPHEMERAL:-}" = "1" ]; then
    SIGNING_MODE="ephemeral"
  else
    cat >&2 <<'MSG'
No release signing store is configured.

Either:
  * run scripts/setup-signing.sh once (creates the keystore on your machine
    and pushes the four JOE_SIGNING_* repository secrets), or
  * set JOE_SIGNING_ALLOW_EPHEMERAL=1 to sign with a per-build key
    (real, installable APK, but every build has a different identity —
    updates need an uninstall/reinstall).
MSG
    exit 1
  fi
else
  : "${JOE_SIGNING_ALIAS:?Release signing alias required}"
  : "${JOE_STORE_PASSWORD:?Store password required}"
  : "${JOE_KEY_PASSWORD:?Key password required}"
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
if [ ! -d "$SDK" ]; then echo "Android SDK not found at $SDK"; exit 1; fi
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/cmdline-tools/tools/bin:$SDK/tools/bin:$PATH"

BT_DIR="$(ls -1 "$SDK/build-tools" | sort -V | tail -1)"
BT="$SDK/build-tools/$BT_DIR"
ANDROID_JAR="$SDK/platforms/android-35/android.jar"
if [ ! -f "$ANDROID_JAR" ]; then
  echo "Installing android-35 platform…"
  sdkmanager --install "platforms;android-35" >/dev/null
fi

AAPT2="$BT/aapt2"
D8="$BT/d8"
ZIPALIGN="$BT/zipalign"
APKSIGNER="$BT/apksigner"
SRC="$ROOT/apps/android/app/src/main"
ASSETS="$ROOT/apps/android/assets"
OUT="$ROOT/apps/android/JoeBrowser.apk"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
mkdir -p "$WORK/gen" "$WORK/classes" "$WORK/dex"

echo "== build-tools: $BT_DIR =="
echo "== aapt2 compile =="
"$AAPT2" compile --dir "$SRC/res" -o "$WORK/res.zip"

echo "== aapt2 link =="
"$AAPT2" link \
  -o "$WORK/base.apk" \
  --no-version-vectors \
  -I "$ANDROID_JAR" \
  --manifest "$SRC/AndroidManifest.xml" \
  -R "$WORK/res.zip" \
  --java "$WORK/gen" \
  -A "$ASSETS" \
  --auto-add-overlay \
  --min-sdk-version 28 \
  --target-sdk-version 35

echo "== javac =="
find "$SRC/java" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
javac -source 8 -target 8 -nowarn \
  -bootclasspath "$ANDROID_JAR" \
  -cp "$ANDROID_JAR" \
  -d "$WORK/classes" \
  @"$WORK/sources.txt"

echo "== d8 =="
mapfile -t CLASSES < <(find "$WORK/classes" -name '*.class')
echo "  ${#CLASSES[@]} class files"
"$D8" --lib "$ANDROID_JAR" --min-api 28 --output "$WORK/dex" "${CLASSES[@]}"

echo "== package =="
cp "$WORK/base.apk" "$WORK/unsigned.apk"
(cd "$WORK/dex" && zip -q -u "$WORK/unsigned.apk" classes.dex)
"$ZIPALIGN" -f 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"

echo "== sign ($SIGNING_MODE) =="
if [ "$SIGNING_MODE" = "release" ]; then
  printf '%s' "$JOE_SIGNING_STORE_B64" | base64 --decode > "$WORK/release.keystore"
  # JKS stores start with the magic 0xFEEDFEED; anything else (e.g. the
  # PKCS#12 produced by scripts/setup-signing.sh or openssl) is PKCS#12.
  if head -c4 "$WORK/release.keystore" | od -An -tx1 | grep -qi "fe ed fe ed"; then
    KS_TYPE="jks"
  else
    KS_TYPE="pkcs12"
  fi
  "$APKSIGNER" sign --ks "$WORK/release.keystore" --ks-type "$KS_TYPE" \
    --ks-key-alias "$JOE_SIGNING_ALIAS" \
    --ks-pass env:JOE_STORE_PASSWORD --key-pass env:JOE_KEY_PASSWORD \
    --out "$WORK/signed.apk" "$WORK/aligned.apk"
else
  # Per-build key: real and installable, but every build has its own
  # identity. Published in Android-signing.txt so nobody is surprised;
  # run scripts/setup-signing.sh once to move to a stable release key.
  STORE_PASS="joe-build-$(openssl rand -hex 8 2>/dev/null || echo random)"
  keytool -genkeypair -keystore "$WORK/ephemeral.p12" -storetype PKCS12 \
    -alias joe-build -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
    -dname "CN=Joe Browser (per-build key), O=Joe Browser" >/dev/null 2>&1
  "$APKSIGNER" sign --ks "$WORK/ephemeral.p12" --ks-type pkcs12 \
    --ks-key-alias joe-build \
    --ks-pass "pass:$STORE_PASS" --key-pass "pass:$STORE_PASS" \
    --out "$WORK/signed.apk" "$WORK/aligned.apk"
fi
"$APKSIGNER" verify "$WORK/signed.apk"
mv "$WORK/signed.apk" "$OUT"

# Publish the certificate identity with every APK — the fingerprint is what
# users and future builds compare to detect an impostor or a re-key.
CERTS="$("$APKSIGNER" verify --print-certs "$OUT" 2>/dev/null || true)"
{
  echo "Joe Browser APK signing"
  echo "======================="
  echo "mode: $SIGNING_MODE"
  if [ "$SIGNING_MODE" = "ephemeral" ]; then
    echo ""
    echo "WARNING: signed with a PER-BUILD key generated inside the CI run."
    echo "This APK installs and runs, but a later build will have a different"
    echo "signature, so updating requires uninstalling first. Run"
    echo "scripts/setup-signing.sh once to give every release one stable key."
  else
    echo "Signed with the project release key (JOE_SIGNING_* secrets)."
  fi
  echo ""
  echo "$CERTS"
} > "$ROOT/apps/android/Android-signing.txt"
cat "$ROOT/apps/android/Android-signing.txt"

echo "== done =="
ls -lh "$OUT"
