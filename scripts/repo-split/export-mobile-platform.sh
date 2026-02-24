#!/usr/bin/env bash
set -euo pipefail

# Export Wave 4 mobile-owned app paths into a target platform repo.
# Usage:
#   scripts/repo-split/export-mobile-platform.sh /absolute/path/to/for-ios
#   scripts/repo-split/export-mobile-platform.sh /absolute/path/to/for-android

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/<mobile-repo>"
  exit 1
fi

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_ROOT="$1"
MOBILE_SRC="$SOURCE_ROOT/apps/mobile"

if [[ ! -d "$TARGET_ROOT" ]]; then
  echo "Target directory does not exist: $TARGET_ROOT"
  exit 1
fi

copy_file() {
  local src="$1"
  local dst="$2"
  mkdir -p "$(dirname "$dst")"
  rsync -a "$src" "$dst"
}

copy_file "$MOBILE_SRC/App.tsx" "$TARGET_ROOT/App.tsx"
copy_file "$MOBILE_SRC/app.json" "$TARGET_ROOT/app.json"
copy_file "$MOBILE_SRC/package.json" "$TARGET_ROOT/package.json"
copy_file "$MOBILE_SRC/tsconfig.json" "$TARGET_ROOT/tsconfig.json"

echo "Export complete -> $TARGET_ROOT"
