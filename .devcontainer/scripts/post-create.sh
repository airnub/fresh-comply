#!/usr/bin/env bash
set -euo pipefail
[[ "${DEBUG:-false}" == "true" ]] && set -x

need() { command -v "$1" >/dev/null 2>&1; }

if ! need pnpm; then echo "[post-create] pnpm is required on PATH" >&2; exit 1; fi

# Ensure handy tooling
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  git jq curl ca-certificates netcat-openbsd
sudo rm -rf /var/lib/apt/lists/*

# Speed up pnpm (use cache mount)
pnpm config set store-dir /home/node/.pnpm-store

echo "[post-create] Installing workspace deps..."
pnpm -w fetch
pnpm -w install --frozen-lockfile

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -x "${SCRIPT_DIR}/install-supabase-cli.sh" ]]; then
  echo "[post-create] Installing Supabase CLI..."
  "${SCRIPT_DIR}/install-supabase-cli.sh"
else
  echo "[post-create] Skipping Supabase CLI installation (script not found or not executable)." >&2
fi

# Make sure current user can talk to Docker daemon
if ! groups | grep -q "\bdocker\b"; then
  echo "[post-create] Adding $USER to docker group..."
  sudo usermod -aG docker "$USER" || true
  echo "[post-create] You may need to rebuild/reopen for docker group to apply."
fi

# Optional: install OpenAI CLI/tools if requested
if [[ "${OPENAI_CLI:-false}" == "true" ]]; then
  if need npm; then
    echo "[post-create] Installing OpenAI JS SDK globally..."
    npm i -g openai@latest || true
  fi
fi
