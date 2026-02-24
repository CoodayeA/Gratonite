#!/usr/bin/env bash
set -euo pipefail

echo "[check:web] Typecheck"
pnpm typecheck

echo "[check:web] Test"
pnpm test

echo "[check:web] Build"
pnpm build

echo "[check:web] PASS"
