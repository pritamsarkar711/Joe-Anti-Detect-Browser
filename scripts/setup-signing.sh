#!/usr/bin/env bash
# One-shot Android release-signing setup for the repository owner.
#
# Run this ONCE on any machine with `gh` (authenticated as a repo admin) and
# openssl (preinstalled on macOS, Linux, and Windows Git Bash):
#
#   bash scripts/setup-signing.sh
#
# It generates a release keystore ON YOUR MACHINE, pushes the four
# JOE_SIGNING_* GitHub Actions secrets, and prints the single command that
# attaches a properly signed JoeBrowser.apk to the current release. The private
# key never touches the repository or any chat.
#
# Already have a keystore (e.g. from Android Studio)? Pass it:
#
#   bash scripts/setup-signing.sh path/to/your.keystore
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
command -v gh >/dev/null || { echo "gh (GitHub CLI) is required — https://cli.github.com"; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

STORE="joe-release-keystore.p12"
ALIAS="joe-release"

if [ "${1:-}" != "" ]; then
  STORE="$1"
  [ -f "$STORE" ] || { echo "keystore not found: $STORE"; exit 1; }
  echo "Using existing keystore: $STORE"
  read -r -p "Key alias inside that keystore: " ALIAS
else
  echo "Generating a new release keystore ($STORE, alias $ALIAS)…"
  read -r -s -p "Keystore password (leave empty to generate one): " STORE_PASS
  echo
  if [ -z "$STORE_PASS" ]; then
    STORE_PASS="$(openssl rand -hex 18)"
    echo "Generated keystore password — SAVE THIS SOMEWHERE SAFE:"
    echo "  $STORE_PASS"
  fi
  read -r -s -p "Key password (leave empty to reuse the keystore password): " KEY_PASS
  echo
  [ -z "$KEY_PASS" ] && KEY_PASS="$STORE_PASS"
  openssl req -x509 -newkey rsa:4096 -sha256 -nodes \
    -keyout /tmp/joe-key.pem -out /tmp/joe-cert.pem -days 10000 \
    -subj "/CN=Joe Browser Release/O=Joe Browser" >/dev/null 2>&1
  openssl pkcs12 -export -out "$STORE" -name "$ALIAS" \
    -inkey /tmp/joe-key.pem -in /tmp/joe-cert.pem \
    -passout "pass:$STORE_PASS" >/dev/null 2>&1
  rm -f /tmp/joe-key.pem /tmp/joe-cert.pem
  chmod 600 "$STORE"
  echo "Keystore written: $STORE (keep a backup — losing it breaks in-place updates)"
fi

if [ "${STORE_PASS:-}" = "" ]; then
  read -r -s -p "Password for $STORE: " STORE_PASS
  echo
  KEY_PASS="$STORE_PASS"
fi

echo "Pushing the four repository secrets (values are never printed)…"
openssl base64 -A -in "$STORE" | gh secret set JOE_SIGNING_STORE_B64
printf '%s' "$ALIAS" | gh secret set JOE_SIGNING_ALIAS
printf '%s' "$STORE_PASS" | gh secret set JOE_STORE_PASSWORD
printf '%s' "$KEY_PASS" | gh secret set JOE_KEY_PASSWORD

echo
echo "Done. The next release build will sign the APK with this key and publish"
echo "its certificate fingerprint in Android-signing.txt. To attach a signed APK"
echo "to the release that exists right now, run:"
echo
echo "  gh workflow run \"Build and publish binaries\" -f tag=$(git describe --tags --abbrev=0 2>/dev/null || echo v3.2.2)"
