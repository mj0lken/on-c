#!/usr/bin/env bash
# Builds on-c.app into ./build. Pass --install to copy it to /Applications.
set -euo pipefail

cd "$(dirname "$0")/.."

APP="build/on-c.app"
TARGET_TRIPLE="aarch64-apple-darwin"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/onc-tauri-target}"

# Ensure dependencies exist when invoked standalone.
if [[ ! -d node_modules ]]; then
  npm ci
fi

# Build frontend with relative asset base for bundled Tauri WebView.
VITE_BASE_PATH="./" node ./node_modules/@tauri-apps/cli/tauri.js build \
  --bundles app \
  --target "$TARGET_TRIPLE"

BUILT_APP="$CARGO_TARGET_DIR/$TARGET_TRIPLE/release/bundle/macos/on-c.app"
if [[ ! -d "$BUILT_APP" ]]; then
  echo "build-app: expected bundle not found at $BUILT_APP" >&2
  exit 1
fi

rm -rf "$APP"
mkdir -p build
cp -R "$BUILT_APP" "$APP"

# The version comes from the release tag, not a commit: VERSION when releasing, otherwise the latest
# tag, so a local build says which release it's built on. The build number only ever goes up.
VERSION="${VERSION:-$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null | sed 's/^v//' || true)}"
BUILD_NUMBER="${BUILD_NUMBER:-$(git rev-list --count HEAD 2>/dev/null || echo 1)}"
if [[ -n "$VERSION" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$APP/Contents/Info.plist"
fi
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$APP/Contents/Info.plist"

# Ad-hoc signature across the entire .app bundle.
codesign --force --deep --sign - "$APP"

echo "Built $APP"

if [[ "${1:-}" == "--install" ]]; then
  if pgrep -x on-c >/dev/null; then
    osascript -e 'quit app id "app.onc.calculator"' 2>/dev/null || true
    for _ in 1 2 3 4 5; do pgrep -x on-c >/dev/null || break; sleep 1; done
    pkill -x on-c 2>/dev/null || true
  fi
  rm -rf "/Applications/on-c.app"
  cp -R "$APP" /Applications/
  echo "Installed to /Applications/on-c.app"
  open /Applications/on-c.app
fi
