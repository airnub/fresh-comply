#!/usr/bin/env bash
set -euo pipefail
[[ "${DEBUG:-false}" == "true" ]] && set -x

need() { command -v "$1" >/dev/null 2>&1; }

if ! need curl; then echo "[install-supabase-cli] curl is required" >&2; exit 1; fi

install_packages() {
  local pkgs=(ca-certificates jq tar sha256sum)
  local missing=()
  for p in "${pkgs[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
  if ((${#missing[@]})); then
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
    sudo rm -rf /var/lib/apt/lists/*
  fi
}

fetch_latest_version() {
  local api="https://api.github.com/repos/supabase/cli/releases/latest"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" "$api" | jq -r '.tag_name'
  else
    curl -fsSL "$api" | jq -r '.tag_name'
  fi
}

download_and_install() {
  local version="$1"
  local arch="$(uname -m)"
  case "$arch" in x86_64|amd64) arch="amd64" ;; aarch64|arm64) arch="arm64" ;; *)
    echo "[install-supabase-cli] Unsupported arch: $arch" >&2; exit 1 ;; esac

  local tmp_dir; tmp_dir="$(mktemp -d)"
  local base="https://github.com/supabase/cli/releases/download/${version}"
  local tarball="supabase_linux_${arch}.tar.gz"
  curl -fsSL "${base}/${tarball}" -o "${tmp_dir}/supabase.tar.gz"
  tar -xzf "${tmp_dir}/supabase.tar.gz" -C "$tmp_dir"

  # Optional checksum verification if sums file exists
  if curl -fsSL "${base}/SHA256SUMS" -o "${tmp_dir}/SHA256SUMS" 2>/dev/null; then
    (cd "$tmp_dir" && sha256sum -c --ignore-missing SHA256SUMS)
  fi

  sudo install -m 0755 "${tmp_dir}/supabase" /usr/local/bin/supabase
  rm -rf "$tmp_dir"
}

main() {
  install_packages
  local req="${SUPABASE_VERSION:-latest}"
  local ver
  if [[ "$req" == "latest" ]]; then ver="$(fetch_latest_version)"; else ver="${req#v}"; ver="v${ver}"; fi
  download_and_install "$ver"
  echo -n "[install-supabase-cli] Installed Supabase CLI version: "; supabase --version
}
main "$@"
