#!/usr/bin/env bash
set -euo pipefail

# Export Wave 3 desktop-owned paths from this monorepo into a target repo checkout.
# Usage:
#   scripts/repo-split/export-for-desktop.sh /absolute/path/to/for-desktop

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/for-desktop"
  exit 1
fi

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_ROOT="$1"

if [[ ! -d "$TARGET_ROOT" ]]; then
  echo "Target directory does not exist: $TARGET_ROOT"
  exit 1
fi

copy_path() {
  local rel="$1"
  local src="$SOURCE_ROOT/$rel"
  local dst="$TARGET_ROOT/$rel"
  mkdir -p "$(dirname "$dst")"
  if [[ -d "$src" ]]; then
    mkdir -p "$dst"
    rsync -a --delete \
      --exclude 'node_modules/' \
      --exclude 'dist/' \
      --exclude '.cache/' \
      "$src/" "$dst/"
  else
    rsync -a "$src" "$dst"
  fi
}

# Desktop app + workspace config
copy_path "apps/desktop"
copy_path "package.json"
copy_path "pnpm-lock.yaml"
copy_path "pnpm-workspace.yaml"
copy_path "tsconfig.base.json"
copy_path "turbo.json"

# Shared packages desktop currently references/contracts
copy_path "packages/types"
copy_path "packages/profile-resolver"
copy_path "packages/api-client"

echo "Export complete -> $TARGET_ROOT"
