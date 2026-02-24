#!/usr/bin/env bash
set -euo pipefail

# Export Wave 1 web-owned paths from this monorepo into a target repo checkout.
# Usage:
#   scripts/repo-split/export-for-web.sh /absolute/path/to/for-web

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/for-web"
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
    rsync -a --delete "$src/" "$dst/"
  else
    rsync -a "$src" "$dst"
  fi
}

# Core app + workspace config
copy_path "apps/web"
copy_path "package.json"
copy_path "pnpm-lock.yaml"
copy_path "pnpm-workspace.yaml"
copy_path "tsconfig.base.json"
copy_path "turbo.json"

# Shared packages needed by web
copy_path "packages/types"
copy_path "packages/profile-resolver"
copy_path "packages/markdown"
copy_path "packages/themes"
copy_path "packages/ui"
copy_path "packages/hooks"
copy_path "packages/i18n"
copy_path "packages/api-client"

# Web gate/hardening docs
mkdir -p "$TARGET_ROOT/docs/release" "$TARGET_ROOT/docs/qa"
copy_path "docs/release/web-release-gates.md"
copy_path "docs/release/web-beta-gate-2026-02-22.md"
copy_path "docs/release/public-beta-hardening.md"
copy_path "docs/qa/web-critical-path-matrix.md"
copy_path "docs/qa/web-e2e.md"

echo "Export complete -> $TARGET_ROOT"
