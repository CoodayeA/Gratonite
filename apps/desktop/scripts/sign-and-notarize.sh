#!/bin/bash
# Sign and Notarize Gratonite for macOS
# Run this script when you have your Developer ID Application certificate set up

set -e

APP_PATH="./release/mac-arm64/Gratonite.app"
ENTITLEMENTS="./assets/entitlements.plist"

echo "🔐 Signing Gratonite.app..."

# Sign the app
codesign --force --deep --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements "$ENTITLEMENTS" \
  "$APP_PATH"

echo "✅ Code signing complete"

# Verify signature
echo "🔍 Verifying signature..."
codesign -dvv "$APP_PATH"

echo ""
echo "📦 Ready for distribution!"
echo ""
echo "To notarize, you'll need to run:"
echo "  xcrun notarytool submit \"$APP_PATH\" --apple-id your@email.com --team-id YOUR_TEAM_ID --password @keychain:AC_PASSWORD"
echo ""
echo "Or use electron-builder with proper credentials configured."
