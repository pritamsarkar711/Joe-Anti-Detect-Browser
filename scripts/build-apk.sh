#!/usr/bin/env bash
# Build a real, signed APK without Gradle or Maven dependencies.
# Uses only the Android SDK build-tools + JDK that ship on GitHub Actions runners.
set -euo pipefail

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
trap 'rm -rf "$WORK"' EXIT
: "${ANDROID_KEYSTORE_BASE64:?Release keystore required}" "${ANDROID_KEY_ALIAS:?Key alias required}"
: "${ANDROID_STORE_PASSWORD:?Store password required}" "${ANDROID_KEY_PASSWORD:?Key password required}"
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

echo "== sign =="
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$WORK/joe.keystore"
"$APKSIGNER" sign --ks "$WORK/joe.keystore" --ks-key-alias "$ANDROID_KEY_ALIAS" \
  --ks-pass env:ANDROID_STORE_PASSWORD --key-pass env:ANDROID_KEY_PASSWORD \
  --out "$OUT" "$WORK/aligned.apk"
"$APKSIGNER" verify "$OUT"

echo "== done =="
ls -lh "$OUT"
