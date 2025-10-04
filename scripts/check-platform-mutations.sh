#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "Error: ripgrep (rg) is required to run this check." >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  TARGET_DIRS=("$@")
else
  TARGET_DIRS=("apps")
fi

PATTERN="from\\('platform\\.[^)]*\\)\\s*\\.(insert|update|upsert|delete)"

set +e
MATCHES=$(rg --pcre2 --glob 'src/**' -n "$PATTERN" "${TARGET_DIRS[@]}" 2>/dev/null)
STATUS=$?
set -e

if [ $STATUS -eq 0 ]; then
  echo "Disallowed Supabase mutations against the platform schema detected:" >&2
  echo "$MATCHES" >&2
  echo >&2
  echo "Please route platform writes through the approved server-side services instead." >&2
  exit 1
elif [ $STATUS -eq 1 ]; then
  exit 0
else
  echo "ripgrep exited with status $STATUS" >&2
  exit $STATUS
fi
