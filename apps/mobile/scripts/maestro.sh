#!/bin/sh
set -eu

JAVA_HOME_DEFAULT_17="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
JAVA_HOME_DEFAULT="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
MAESTRO_BIN_DIR="${HOME}/.maestro/bin"

JAVA_HOME_RESOLVED="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"

if [ -z "${JAVA_HOME_RESOLVED}" ] && [ -d "${JAVA_HOME_DEFAULT_17}" ]; then
  JAVA_HOME_RESOLVED="${JAVA_HOME_DEFAULT_17}"
fi

if [ -z "${JAVA_HOME_RESOLVED}" ] && [ -d "${JAVA_HOME_DEFAULT}" ]; then
  JAVA_HOME_RESOLVED="${JAVA_HOME_DEFAULT}"
fi

if [ -z "${JAVA_HOME_RESOLVED}" ]; then
  echo "Unable to find a Java runtime for Maestro." >&2
  echo "Install OpenJDK 17 with: brew install openjdk@17" >&2
  exit 1
fi

export JAVA_HOME="${JAVA_HOME_RESOLVED}"
export PATH="${JAVA_HOME}/bin:${PATH}"
if ! command -v maestro >/dev/null 2>&1 && [ -d "${MAESTRO_BIN_DIR}" ]; then
  export PATH="${MAESTRO_BIN_DIR}:${PATH}"
fi
export MAESTRO_CLI_NO_ANALYTICS="${MAESTRO_CLI_NO_ANALYTICS:-1}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Unable to find Maestro CLI." >&2
  echo "Install it with: curl -fsSL https://get.maestro.mobile.dev | bash" >&2
  exit 1
fi

exec maestro "$@"
