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

- **Deep keyset page (2026-09-25 run):** the expanded `OR` keyset predicate is applied as an index `Filter`, not an `Index Cond`: `Rows Removed by Filter: 25001` and `shared hit=25386` buffers to return 51 rows. Fixed in the 2026-09-27 run by the row-value predicate (see below).
- **Personal records:** all three PR plans use `Parallel Seq Scan on workout_sets` (174,823 rows total, ~87k per process) hash-joined to index-selected entries, then a top-N sort. At ~31–34 ms this is acceptable for this dataset but grows with the user's total set count.
- **Representative SQL:** `explain-50k.sql` hand-writes the history and PR query shapes. It is not a capture of the SQL the running service emits: TypeORM generates the history query, and the PR script selects fewer columns. The recorded output used `LIMIT 51` for history and PR ties ending at `set_order`, without the service's final `ws.id ASC` tie-breaker (unique `(workout_entry_id, set_order)` already makes it redundant for ordering). The current script uses `LIMIT 21` and includes `ws.id ASC` (`559d630`); it has not been rerun.
- **Dataset:** 8 catalog rows seeded, 7 used by entries; set count and weights are deterministic hashes, not real user distributions.

## 2026-09-27 rerun (row-value keyset)

| File | SHA-256 |
| --- | --- |
| [`2026-09-27-local-50k-seed.out`](2026-09-27-local-50k-seed.out) | `a123207f05d6e022604f31f462c5c4044eac2d1f3c96b74ae030158977432ba1` (identical to the 2026-09-25 seed: the seed is deterministic) |
| [`2026-09-27-local-50k-explain.out`](2026-09-27-local-50k-explain.out) | `343d41d84163244702cb66340b1e1c8a0657cd3d403ad1acf2476cd4f7be09fb` |

- **Where:** fresh `postgres:16-alpine` container (PostgreSQL 16.15), migrated with `pnpm migration:run` at `6bf6ac6` plus the row-value predicate change; seeded once with `run-50k-evidence.sh`.
- **How:** the current `explain-50k.sql` (`LIMIT 21`, `ws.id` tie key) was run five times against the old expanded predicate and five times after switching to the row-value predicate. The committed explain file is the fifth post-change run; per-query ranges are in [`docs/verification.md`](../../docs/verification.md#50k-query-plan-evidence).
- **Deep keyset page:** `Index Cond: ... ROW(workout_date, created_at, id) < ROW(...)`, `shared hit=27`, ~0.1 ms (was a `Filter` removing 25,001 rows, ~25k buffers, 5.8–9.2 ms on the same data).
- **Equivalence check:** before switching, both predicates were compared on 540 cursors (500 random plus 40 rows sharing one `workout_date` and `created_at` to exercise the `id` tie-break); every next page of 21 IDs matched.
- **Unchanged:** PR plans still use `Parallel Seq Scan on workout_sets`, 25–50 ms across runs, with one 125 ms outlier on the heaviest query in run 3 (laptop noise; not filtered out).
- **Still not:** HTTP latency, throughput, percentiles, or 10k-concurrent-coach capacity.
