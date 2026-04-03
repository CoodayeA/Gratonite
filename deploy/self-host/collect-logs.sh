#!/usr/bin/env bash
set -euo pipefail

# Collect a support bundle for self-host troubleshooting.
# Usage: bash ./collect-logs.sh

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: docker compose not found."
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BASE_DIR="support"
WORK_DIR="${BASE_DIR}/gratonite-support-${TS}"
ARCHIVE_PATH="${WORK_DIR}.tar.gz"

mkdir -p "${WORK_DIR}"

write_or_note() {
  local out_file="$1"
  shift
  if "$@" >"${out_file}" 2>&1; then
    return 0
  fi
  echo "Command failed: $*" >>"${out_file}"
}

# Basic environment and runtime metadata
write_or_note "${WORK_DIR}/meta.txt" sh -c "
  echo 'timestamp_utc=${TS}'
  echo 'pwd='\"\$(pwd)\"''
  echo 'os='\"\$(uname -a)\"''
"

write_or_note "${WORK_DIR}/docker-version.txt" docker version
write_or_note "${WORK_DIR}/docker-info.txt" docker info
write_or_note "${WORK_DIR}/compose-version.txt" "${COMPOSE[@]}" version
write_or_note "${WORK_DIR}/compose-ps.txt" "${COMPOSE[@]}" -f docker-compose.yml ps -a

# Capture env keys only (values redacted by default)
if [ -f .env ]; then
  awk -F= '
    BEGIN { print "# .env keys (values redacted)" }
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      key=$1
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      if (key != "") print key "=<redacted>"
    }
  ' .env >"${WORK_DIR}/env-redacted.txt"
else
  echo ".env not found in $(pwd)" >"${WORK_DIR}/env-redacted.txt"
fi

for svc in setup postgres redis api web caddy livekit; do
  write_or_note "${WORK_DIR}/logs-${svc}.txt" "${COMPOSE[@]}" -f docker-compose.yml logs --tail 300 "${svc}"
done

# Archive and print path for easy sharing
if command -v tar >/dev/null 2>&1; then
  tar -czf "${ARCHIVE_PATH}" -C "${BASE_DIR}" "$(basename "${WORK_DIR}")"
  echo "Support bundle created: ${ARCHIVE_PATH}"
else
  echo "Support folder created: ${WORK_DIR}"
fi

