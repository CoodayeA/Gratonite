#!/bin/bash
set -euo pipefail

# Build a Gratonite .flatpak bundle for self-hosted distribution.
#
# Prerequisites:
#   flatpak install flathub org.freedesktop.Platform//25.08
#   flatpak install flathub org.freedesktop.Sdk//25.08
#   flatpak install flathub org.electronjs.Electron2.BaseApp//25.08
#
# Usage:
#   1. Build the Linux tarball first:
#        cd apps/desktop && npm run build:linux-tar
#   2. Upload the tarball to gratonite.chat/downloads/
#   3. Update the sha256 hash:
#        cd flatpak && ./build-flatpak.sh --update-hash /path/to/Gratonite-X.Y.Z-linux-x64.tar.gz
#   4. Build the Flatpak:
#        ./build-flatpak.sh
#
# Output:
#   Gratonite-<version>.flatpak in the current directory

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VERSION=$(node -e "console.log(require('../package.json').version)")
APP_ID="chat.gratonite.Desktop"
BUILD_DIR="build-dir"
REPO_DIR="repo"
MANIFEST="${APP_ID}.json"

# If --update-hash flag is passed with a tarball path, update the sha256 in the manifest
if [ "${1:-}" = "--update-hash" ] && [ -n "${2:-}" ]; then
    TARBALL="$2"
    if [ ! -f "$TARBALL" ]; then
        echo "ERROR: Tarball not found: $TARBALL"
        exit 1
    fi
    HASH=$(sha256sum "$TARBALL" | cut -d' ' -f1)
    echo "Updating sha256 in ${MANIFEST}:"
    echo "  ${HASH}"

    # Use python for reliable JSON manipulation
    python3 -c "
import json, sys
with open('${MANIFEST}') as f:
    m = json.load(f)
m['modules'][0]['sources'][0]['sha256'] = '${HASH}'
m['modules'][0]['sources'][0]['url'] = 'https://gratonite.chat/downloads/Gratonite-${VERSION}-linux-x64.tar.gz'
with open('${MANIFEST}', 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
"
    echo "Manifest updated."
    exit 0
fi

# Verify the hash is not a placeholder
CURRENT_HASH=$(python3 -c "import json; print(json.load(open('${MANIFEST}'))['modules'][0]['sources'][0]['sha256'])")
if [[ "$CURRENT_HASH" == PLACEHOLDER* ]] || [[ "$CURRENT_HASH" == "0000"* ]]; then
    echo "ERROR: sha256 hash in ${MANIFEST} is still a placeholder."
    echo ""
    echo "Build the Linux tarball and update the hash first:"
    echo "  cd apps/desktop && npm run build:linux-tar"
    echo "  cd flatpak && ./build-flatpak.sh --update-hash ../dist/Gratonite-${VERSION}-linux-x64.tar.gz"
    exit 1
fi

echo "Building Gratonite Flatpak v${VERSION}..."

# Verify SVG icon exists
if [ ! -f "${APP_ID}.svg" ]; then
    echo "ERROR: ${APP_ID}.svg not found."
    exit 1
fi

# Build
flatpak-builder \
    --force-clean \
    --repo="$REPO_DIR" \
    "$BUILD_DIR" \
    "$MANIFEST"

# Bundle into a single .flatpak file
flatpak build-bundle \
    "$REPO_DIR" \
    "Gratonite-${VERSION}.flatpak" \
    "$APP_ID"

echo ""
echo "Built: Gratonite-${VERSION}.flatpak"
echo ""
echo "Install locally with:"
echo "  flatpak install Gratonite-${VERSION}.flatpak"
echo ""
echo "Run with:"
echo "  flatpak run ${APP_ID}"
