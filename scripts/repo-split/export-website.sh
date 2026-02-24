#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/repo-split/export-website.sh /absolute/path/to/gratonite.chat

TARGET_REPO_DIR="${1:-}"
if [[ -z "$TARGET_REPO_DIR" ]]; then
  echo "usage: $0 /absolute/path/to/gratonite.chat" >&2
  exit 1
fi

SOURCE_DIR="apps/website"
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_REPO_DIR"
rsync -a --delete \
  --exclude '.git' \
  "$SOURCE_DIR/" "$TARGET_REPO_DIR/"

echo "export complete -> $TARGET_REPO_DIR"
