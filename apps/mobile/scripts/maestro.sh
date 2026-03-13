#!/bin/sh
set -eu

JAVA_HOME_DEFAULT="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
JAVA_HOME_RESOLVED="$(/usr/libexec/java_home -v 25 2>/dev/null || true)"

if [ -z "${JAVA_HOME_RESOLVED}" ] && [ -d "${JAVA_HOME_DEFAULT}" ]; then
  JAVA_HOME_RESOLVED="${JAVA_HOME_DEFAULT}"
fi

if [ -z "${JAVA_HOME_RESOLVED}" ]; then
  echo "Unable to find a Java runtime for Maestro." >&2
  echo "Install OpenJDK 25 with: brew install openjdk" >&2
  exit 1
fi

export JAVA_HOME="${JAVA_HOME_RESOLVED}"
export PATH="${JAVA_HOME}/bin:${PATH}"
export MAESTRO_CLI_NO_ANALYTICS="${MAESTRO_CLI_NO_ANALYTICS:-1}"

exec maestro "$@"
