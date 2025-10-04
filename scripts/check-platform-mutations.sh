#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "Error: ripgrep (rg) is required to run this check." >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  TARGET_DIRS=("$@")
else
  TARGET_DIRS=("apps" "packages/ui")
fi

PATTERN="from\\((?:'|\")platform\\.[^)]*\\)\\s*\\.(insert|update|upsert|delete)"

set +e
MATCHES=$(rg --pcre2 --glob 'src/**' -n "$PATTERN" "${TARGET_DIRS[@]}" 2>/dev/null)
STATUS=$?
set -e

if [ $STATUS -eq 0 ]; then
  FILTERED="$MATCHES"

  if [ -n "${PLATFORM_MUTATION_ALLOWLIST:-}" ]; then
    IFS=',' read -r -a ALLOWLIST <<<"${PLATFORM_MUTATION_ALLOWLIST}"
    if [ ${#ALLOWLIST[@]} -gt 0 ]; then
      ALLOW_REGEX=""
      for entry in "${ALLOWLIST[@]}"; do
        TRIMMED=$(echo "$entry" | xargs)
        if [ -z "$TRIMMED" ]; then
          continue
        fi
        ESCAPED=$(printf '%s' "$TRIMMED" | sed 's/[.[\\^$*+?(){|]/\\&/g; s/]/\\]/g; s/-/\\-/g')
        if [ -z "$ALLOW_REGEX" ]; then
          ALLOW_REGEX="^${ESCAPED}"
        else
          ALLOW_REGEX="${ALLOW_REGEX}|^${ESCAPED}"
        fi
      done

      if [ -n "$ALLOW_REGEX" ]; then
        FILTERED=$(printf '%s\n' "$FILTERED" | grep -vE "$ALLOW_REGEX" || true)
      fi
    fi
  fi

  if [ -n "$FILTERED" ]; then
    echo "Disallowed Supabase mutations against the platform schema detected:" >&2
    echo "$FILTERED" >&2
    echo >&2
    echo "Please route platform writes through the approved server-side services instead." >&2
    exit 1
  fi
  exit 0
elif [ $STATUS -eq 1 ]; then
  exit 0
else
  echo "ripgrep exited with status $STATUS" >&2
  exit $STATUS
fi
