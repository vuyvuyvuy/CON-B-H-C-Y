#!/usr/bin/env bash
# Chạy migration + smoke test trên Postgres local (cần pgvector). Dùng: DB_URL=postgres://... scripts/test-db.sh
set -euo pipefail
DB_URL="${DB_URL:-postgres://postgres@localhost/postgres}"
DB="cbcc_test_$$"
psql "$DB_URL" -qc "create database $DB"
trap 'psql "$DB_URL" -qc "drop database $DB" >/dev/null' EXIT
URL="${DB_URL%/*}/$DB"
for f in supabase/tests/00_supabase_stubs.sql supabase/migrations/*.sql supabase/tests/10_smoke.sql; do
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
