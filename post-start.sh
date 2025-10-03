#!/usr/bin/env bash
set -euo pipefail
[[ "${DEBUG:-false}" == "true" ]] && set -x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

need() { command -v "$1" >/dev/null 2>&1; }

if need docker; then docker info >/dev/null 2>&1 || echo "[post-start] Warning: Docker daemon not reachable"; fi

if need supabase && [[ "${AUTO_START_SUPABASE:-false}" == "true" ]]; then
  echo "[post-start] Checking Supabase local stack..."
  if supabase status >/dev/null 2>&1; then
    echo "[post-start] Supabase already running."
  else
    echo "[post-start] Starting Supabase..."
    supabase start
  fi

  # Wait for Postgres before env sync (max ~60s)
  echo -n "[post-start] Waiting for Postgres 54322"
  for i in {1..60}; do
    if nc -z 127.0.0.1 54322; then echo " ✓"; break; fi
    echo -n "."
    sleep 1
  done

  # If you have a script to sync env from Supabase, run it
  if need pnpm && jq --version >/dev/null 2>&1; then
    if pnpm -w run | grep -q "db:env:local"; then
      echo "[post-start] Syncing env via pnpm db:env:local"
      pnpm db:env:local || true
    fi
  fi
else
  echo "[post-start] Skipping Supabase startup (AUTO_START_SUPABASE=false or CLI missing)."
fi
