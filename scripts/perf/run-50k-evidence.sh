#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=postgresql://everfit:everfit@127.0.0.1:55432/everfit \
#   scripts/perf/run-50k-evidence.sh
# The application schema must already exist; run the versioned migrations
# before collecting evidence (for example, `pnpm migration:run`).
: "${DATABASE_URL:?Set DATABASE_URL to the local PostgreSQL database}"
perf_user_id="${PERF_USER_ID:-perf-50k-user}"
entry_count="${PERF_ENTRY_COUNT:-50000}"
output_dir="${PERF_OUTPUT_DIR:-notes/evidence}"

mkdir -p "$output_dir"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v perf_user_id="$perf_user_id" -v entry_count="$entry_count" \
  -f scripts/perf/seed-50k.sql | tee "$output_dir/seed-50k.out"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v perf_user_id="$perf_user_id" \
  -f scripts/perf/explain-50k.sql | tee "$output_dir/explain-50k.out"
