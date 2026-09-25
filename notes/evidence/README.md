# 50k query-plan evidence (recorded local output)

These files are byte-for-byte copies of the psql output recorded by `scripts/perf/run-50k-evidence.sh` in one local run. They were copied from `/tmp/everfit-perf-evidence/` into the repository on 2026-09-26; nothing was rerun or edited. Trailing spaces are psql's own formatting (see `.gitattributes`).

| File | Source | SHA-256 |
| --- | --- | --- |
| [`2026-09-25-local-50k-seed.out`](2026-09-25-local-50k-seed.out) | `/tmp/everfit-perf-evidence/seed-50k.out` | `a123207f05d6e022604f31f462c5c4044eac2d1f3c96b74ae030158977432ba1` |
| [`2026-09-25-local-50k-explain.out`](2026-09-25-local-50k-explain.out) | `/tmp/everfit-perf-evidence/explain-50k.out` | `a52e93a330b52c7a7f1c881568ccd743326f5a8c350157e0ae7dc67d9c146704` |

- **When:** both source files were last modified 2026-09-25 23:57:14 +07:00, after commit `6259c48` and before `6dd112b`/`b2813a0`. Later, `a920c68` added UUID primary-key defaults to the migration (no index change; the seed inserts explicit IDs) and `559d630` changed `explain-50k.sql` (see below). These files were not regenerated after either change.
- **Where:** a fresh local PostgreSQL 16-alpine container (port 55433) migrated with `pnpm migration:run` (the migration revision before `a920c68`); one user, `perf-50k-user`. Hardware and cache state were not recorded beyond "warm-ish" (the plans show only `shared hit` buffers).
- **What it is:** one `EXPLAIN (ANALYZE, BUFFERS)` run per query shape, from [`scripts/perf/explain-50k.sql`](../../scripts/perf/explain-50k.sql).
- **What it is not:** HTTP endpoint latency, throughput, a repeated/statistical benchmark, or evidence of capacity for 10k concurrent coaches.

## Known limitations visible in the output

- **Deep keyset page:** the expanded `OR` keyset predicate is applied as an index `Filter`, not an `Index Cond`: `Rows Removed by Filter: 25001` and `shared hit=25386` buffers to return 51 rows. Cost grows with page depth. A row-value predicate `(workout_date, created_at, id) < (...)` that PostgreSQL can use as an index bound is a candidate fix; it is not implemented or measured.
- **Personal records:** all three PR plans use `Parallel Seq Scan on workout_sets` (174,823 rows total, ~87k per process) hash-joined to index-selected entries, then a top-N sort. At ~31–34 ms this is acceptable for this dataset but grows with the user's total set count.
- **Representative SQL:** `explain-50k.sql` hand-writes the history and PR query shapes. It is not a capture of the SQL the running service emits: TypeORM generates the history query, and the PR script selects fewer columns. The recorded output used `LIMIT 51` for history and PR ties ending at `set_order`, without the service's final `ws.id ASC` tie-breaker (unique `(workout_entry_id, set_order)` already makes it redundant for ordering). The current script uses `LIMIT 21` and includes `ws.id ASC` (`559d630`); it has not been rerun.
- **Dataset:** 8 catalog rows seeded, 7 used by entries; set count and weights are deterministic hashes, not real user distributions.
