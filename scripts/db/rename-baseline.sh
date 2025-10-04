#!/usr/bin/env bash
set -euo pipefail
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/db/migrations}"
BASELINE_DIR="${BASELINE_DIR:-packages/db/migrations.baseline}"

echo "This will replace $MIGRATIONS_DIR with $BASELINE_DIR"
read -p "Proceed? (y/N) " yn
[[ "${yn:-N}" == "y" ]] || exit 1

rm -rf "$MIGRATIONS_DIR"
mkdir -p "$MIGRATIONS_DIR"
cp "$BASELINE_DIR"/*.sql "$MIGRATIONS_DIR"/
git add "$MIGRATIONS_DIR" && echo "✅ Copied baseline into $MIGRATIONS_DIR"

echo "You may now remove $BASELINE_DIR after review."
