#!/usr/bin/env bash
set -euo pipefail

# --- CONFIG ---------------------------------------------------------------
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/db/migrations}"
OUT_DIR="${OUT_DIR:-packages/db/migrations.baseline}"
PGVER="${PGVER:-15}"
DBUSER="${DBUSER:-postgres}"
DBNAME_A="squash_a"
DBNAME_B="squash_b"
DOCKER_NAME="freshcomply-pg-squash"

# --- CLEAN ---------------------------------------------------------------
docker rm -f "$DOCKER_NAME" >/dev/null 2>&1 || true
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# --- SPIN UP SCRATCH POSTGRES -------------------------------------------
docker run -d --name "$DOCKER_NAME" -e POSTGRES_PASSWORD=postgres -p 55432:5432 "postgres:$PGVER" >/dev/null
echo "⏳ Waiting for Postgres $PGVER..."
until docker exec "$DOCKER_NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

# Helper psql
PSQL="docker exec -i $DOCKER_NAME psql -U $DBUSER -v ON_ERROR_STOP=1"

# --- CREATE TWO FRESH DBS -----------------------------------------------
echo "🧪 Creating scratch DBs..."
echo "create database $DBNAME_A;" | eval "$PSQL" postgres
echo "create database $DBNAME_B;" | eval "$PSQL" postgres

# --- APPLY CURRENT MIGRATIONS INTO DB A ----------------------------------
echo "📜 Applying current migrations from $MIGRATIONS_DIR to $DBNAME_A ..."
shopt -s nullglob
for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "  → $f"
  cat "$f" | eval "$PSQL" "$DBNAME_A" >/dev/null
done

# --- DUMP END-STATE DDL FROM DB A ----------------------------------------
echo "🧾 Dumping end-state DDL..."
docker exec "$DOCKER_NAME" pg_dump -U "$DBUSER" -s --no-owner --no-privileges "$DBNAME_A" > "$OUT_DIR/schema_dump.sql"

# --- SPLIT INTO LOGICAL GROUPS ------------------------------------------
# You can tweak the splitting strategy if you want finer granularity.
echo "✂️  Splitting DDL into baseline files..."
# 000_extensions.sql
awk '/^-- Name: / && /EXTENSION/ {p=1} p {print} /^$/ && NR>1 && p && /;$/ {p=0}' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/000_extensions.sql" || true
# 010_schemas.sql
grep -nE "^CREATE SCHEMA " "$OUT_DIR/schema_dump.sql" >/dev/null 2>&1 && \
  awk '/^CREATE SCHEMA /, /;/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/010_schemas.sql" || true
# 020_types_domains.sql
awk '/^-- Name: / && /(TYPE|DOMAIN)/, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/020_types_domains.sql" || true
# 030_tables.sql
awk '/^-- Name: / && /TABLE /, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/030_tables.sql" || true
# 040_functions.sql
awk '/^-- Name: / && /(FUNCTION)/, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/040_functions.sql" || true
# 050_rls_policies.sql
awk '/^-- Name: / && /POLICY /, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/050_rls_policies.sql" || true
# 060_sequences_defaults.sql
awk '/^-- Name: / && /(SEQUENCE|DEFAULT)/, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/060_sequences_defaults.sql" || true
# 070_indexes_constraints.sql
awk '/^-- Name: / && /(INDEX|CONSTRAINT)/, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/070_indexes_constraints.sql" || true
# 080_views_matviews.sql
awk '/^-- Name: / && /(VIEW|MATERIALIZED VIEW)/, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/080_views_matviews.sql" || true
# 090_triggers.sql
awk '/^-- Name: / && /TRIGGER /, /^$/' "$OUT_DIR/schema_dump.sql" > "$OUT_DIR/090_triggers.sql" || true

# remove empties
find "$OUT_DIR" -type f -size 0 -delete

# --- VERIFY BASELINE: APPLY TO DB B -------------------------------------
echo "🔁 Verifying baseline applies cleanly..."
for f in $(ls "$OUT_DIR"/*.sql | sort); do
  echo "  → $f"
  cat "$f" | eval "$PSQL" "$DBNAME_B" >/dev/null
done

# --- DUMP DB B AND DIFF --------------------------------------------------
docker exec "$DOCKER_NAME" pg_dump -U "$DBUSER" -s --no-owner --no-privileges "$DBNAME_B" > "$OUT_DIR/schema_dump_baseline.sql"

echo "🧮 Comparing original end-state vs baseline end-state..."
if diff -u "$OUT_DIR/schema_dump.sql" "$OUT_DIR/schema_dump_baseline.sql" >/dev/null; then
  echo "✅ Baseline matches current end-state."
else
  echo "❌ Baseline mismatch. See diff below:" >&2
  diff -u "$OUT_DIR/schema_dump.sql" "$OUT_DIR/schema_dump_baseline.sql" || true
  echo "Aborting. Please adjust the split logic or check for non-deterministic DDL ordering." >&2
  exit 1
fi

echo "📦 New baseline ready in: $OUT_DIR"
echo "💡 Next: replace $MIGRATIONS_DIR with $OUT_DIR (after review), and delete the old files in a single commit."
