#!/bin/sh
set -eu

RUNTIME_ENV="/app/keys/runtime.env"

if [ -f "$RUNTIME_ENV" ]; then
  set -a
  . "$RUNTIME_ENV"
  set +a
fi

exec node dist/index.js
