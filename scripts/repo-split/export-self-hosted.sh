#!/usr/bin/env bash
set -euo pipefail

# Export Wave 2 self-hosted paths from this monorepo into a target repo checkout.
# Usage:
#   scripts/repo-split/export-self-hosted.sh /absolute/path/to/self-hosted

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/self-hosted"
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

# API + database + infra
copy_path "apps/api"
copy_path "packages/db"
copy_path "packages/types"
copy_path "docker-compose.yml"
copy_path "livekit.yaml"
copy_path "scripts"
copy_path "package.json"
copy_path "pnpm-lock.yaml"
copy_path "pnpm-workspace.yaml"
copy_path "tsconfig.base.json"
copy_path "turbo.json"

mkdir -p "$TARGET_ROOT/docs/release"
copy_path "docs/release/public-beta-hardening.md"

echo "Export complete -> $TARGET_ROOT"
