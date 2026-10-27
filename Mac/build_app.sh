#!/bin/bash
#
# Builds Salchi.app from the Swift package.
#
#   ./build_app.sh           Notion edition  → Salchi.app
#   ./build_app.sh --local   Local edition   → Salchi sin Notion.app (tasks stay on this Mac)
#
# If a previous copy is in /Applications it is replaced and relaunched. A zip ready to share
# with someone else is saved in "With Notion/" or "No Notion/".

set -euo pipefail
cd "$(dirname "$0")"

EDITION="notion"
APP_NAME="Salchi"
BUNDLE_ID="com.claudia.salchi"
SHARE_DIR="With Notion"
if [[ "${1:-}" == "--local" ]]; then
  EDITION="local"
  APP_NAME="Salchi sin Notion"
  BUNDLE_ID="com.claudia.salchi.local"   # separate settings from the Notion edition
  SHARE_DIR="No Notion"
fi
APP="$APP_NAME.app"

# A moved folder leaves the build cache pointing at the old path: clean it and retry.
if ! swift build -c release; then
  echo "Cleaning the build cache and retrying…"
  rm -rf .build
  swift build -c release
fi

# Assemble the bundle by hand: SwiftPM builds a bare executable, not an .app.
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/Salchi "$APP/Contents/MacOS/Salchi"
cp Resources/Salchi.icns "$APP/Contents/Resources/Salchi.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Salchi</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleIconFile</key><string>Salchi</string>
  <key>CFBundleExecutable</key><string>Salchi</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.1</string>
  <key>CFBundleVersion</key><string>2</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>SalchiEdition</key><string>$EDITION</string>
</dict>
</plist>
PLIST

# Ad-hoc signature: enough to run on this Mac (Gatekeeper still warns on other Macs).
codesign --force --deep -s - "$APP"

# Zip for sharing; ditto keeps the bundle's metadata intact.
mkdir -p "$SHARE_DIR"
ZIP="$SHARE_DIR/${APP_NAME// /-}-mac.zip"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

if [ -d "/Applications/$APP" ]; then
  pkill -f "/Applications/$APP/Contents/MacOS/Salchi" 2>/dev/null || true
  rm -rf "/Applications/$APP"
  cp -R "$APP" /Applications/
  open "/Applications/$APP"
  echo "Updated /Applications/$APP"
fi

echo ""
echo "Done: $(pwd)/$APP"
echo "Shareable zip: $(pwd)/$ZIP"
