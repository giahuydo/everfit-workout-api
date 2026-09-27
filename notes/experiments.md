# Experiments Log

Use this file only for measurements actually run during implementation. Do not pre-fill results or performance claims.

## Experiment template

### Title

- Date:
- Git state / commit:
- Question being tested:
- Dataset shape (users, entries/user, sets/entry, exercise distribution):
- Environment (PostgreSQL version, hardware, pool, warm/cold cache):
- Query SQL/parameters and index state:
- Command / SQL:

### Result

- Observed output:
- `EXPLAIN (ANALYZE, BUFFERS)` summary when relevant:
- Latency / row counts when measured:
- Evidence file or pasted excerpt:

### Decision

- Keep/change/reject:
- Why:
- Follow-up:

## Planned experiment areas

- history query with 50k+ entries for one user
- exact exercise PR query over representative sets
- partial exercise-name search and whether `pg_trgm` is justified
- keyset pagination across dense same-date data and inserts between pages
- comparison of actual user/exercise/date query plans before changing indexes

## 50k query-plan verification — measured once

- Date: 2026-09-25 23:57 +07:00 (modification time of the recorded output files; earlier notes said "2026-09-26 local time", which was the documentation date, not the run time)
- Git state: `integration/final`, after `6ca7daa`. Later changes relevant to this run: `068c29b` added UUID primary-key defaults to the migration (no index change; the seed supplies explicit IDs, so the measured plans are unaffected), and `a8c3d46` aligned `explain-50k.sql` with the service's `LIMIT 21` lookahead and final `ws.id` PR tie key. The run has not been repeated with the updated script.
- Question being tested: whether the two existing `workout_entries` indexes are sufficient for representative history and all three personal-record query shapes before proposing another index.
- Dataset shape: one user, 50,000 workout entries, 174,823 sets (2–5 per entry), seven distinct exercises used out of eight seeded catalog rows, dates 2022-09-27 through 2026-09-25 skewed toward the last 90 days.
- Environment: fresh PostgreSQL 16-alpine container on port 55433; one local warm-ish run (all buffers `shared hit`); hardware not recorded.
- Migration verification: the versioned migration (its revision before `068c29b`, without UUID defaults) succeeded from an empty database with `pnpm migration:run`; `pnpm migration:show` returned `[X] 1 InitialSchema1770000000000`. That command output was not saved to a file. The current migration is exercised by `test/migrations.e2e-spec.ts` (2/2 on 2026-09-26).
- Command: `scripts/perf/run-50k-evidence.sh` (runs `scripts/perf/seed-50k.sql` then `scripts/perf/explain-50k.sql`).
- Evidence: [`notes/evidence/2026-09-25-local-50k-seed.out`](evidence/2026-09-25-local-50k-seed.out) and [`notes/evidence/2026-09-25-local-50k-explain.out`](evidence/2026-09-25-local-50k-explain.out), verbatim copies of the original `/tmp/everfit-perf-evidence/` output; provenance and checksums in [`notes/evidence/README.md`](evidence/README.md).

### Result

| Query shape | Execution time | Plan notes |
| --- | --- | --- |
| History, unfiltered first page (`LIMIT 51`) | 0.179 ms | Index Scan on `idx_workout_entries_user_cursor`, 56 buffers |
| History, partial name + date + muscle group | 0.075 ms | Same index with date range in `Index Cond`; 55 buffers |
| History, deep keyset page after row 25,001 | 7.359 ms | Same index, but the keyset `OR` predicate is a `Filter`: 25,001 rows removed, 25,386 buffers |
| PR heaviest set | 30.783 ms | Bitmap scan on `idx_workout_entries_user_exercise_date`; **Parallel Seq Scan on `workout_sets`**; top-N sort |
| PR highest volume | 31.498 ms | Same plan shape |
| PR estimated 1RM | 34.247 ms | Same plan shape |

Limitations:

- **Deep pages are not O(page size).** The expanded `OR` predicate is not used as an index bound, so page N reads roughly all earlier rows for that user. It is fast at 25k rows in cache but grows linearly with depth.
- **PR queries scan all sets in parallel.** The entries side is indexed, but `workout_sets` is read via parallel sequential scan and hash-joined. Cost grows with total set count, not with the date range.
- **Representative SQL, not captured service SQL.** The history queries are hand-written equivalents of the TypeORM query. In the recorded run, history used `LIMIT 51` and the PR queries omitted the service's final `ws.id` tie-breaker (redundant for ordering given unique `(workout_entry_id, set_order)`) and some selected columns. `a8c3d46` updated the script to `LIMIT 21` and the `ws.id` tie key; those timings are not measured.
- **One run.** No repetitions, percentiles, cold-cache run, HTTP latency, concurrency, or throughput. It does not show capacity for 10k concurrent coaches.

### Decision

- Keep the existing indexes unchanged: `idx_workout_entries_user_cursor`, `idx_workout_entries_user_exercise_date`, the exercises normalized-name unique index, and the workout-set entry/order unique index.
- Why: the measured plans were acceptable for the assignment's 50k-entries-per-user target, so no trigram or PR-ranking index was added on speculation.
- Follow-up: the keyset row-value rewrite was implemented and re-measured on 2026-09-27 (next section). If PR latency matters at larger set counts, test a covering `workout_sets(workout_entry_id)`-driven plan or a per-exercise projection before adding infrastructure.
- Earlier agent reports that migration and performance verification were blocked accurately described their sandbox's local TCP/Docker restriction; that environmental claim is stale for the human/orchestrator environment that produced this run.

## 2026-09-27 — 50k rerun and row-value keyset predicate

- Setup: fresh `postgres:16-alpine` (16.15), `pnpm migration:run`, seeded once with `scripts/perf/run-50k-evidence.sh` (50,000 entries, 174,823 sets; seed output byte-identical to 2026-09-25). The current `explain-50k.sql` (`LIMIT 21`, `ws.id` tie key) was run five times before and five times after the change.
- Before (expanded `OR`): the deep page after row 25,001 took 5.8–9.2 ms, `Rows Removed by Filter: 25001`, ~25,356 buffers — the 2026-09-25 finding reproduced.
- Change: `WorkoutsService` now uses `(workout_date, created_at, id) < (d, c, id)`. Valid because all three sort keys are `DESC`, matching `idx_workout_entries_user_cursor`.
- Equivalence check: on the seeded data plus 40 injected rows sharing one `workout_date` and `created_at`, both predicates were compared on 540 cursors; every next page of 21 IDs matched (0 mismatches). Unit (73/73) and E2E (32/32) suites pass; the tie case is now a permanent E2E regression test (33/33).
- After: the deep page uses the predicate as an `Index Cond`, 27 buffers, 0.10–0.60 ms. First-page and filtered history unchanged (≤0.6 ms). PR queries unchanged in shape (`Parallel Seq Scan on workout_sets`), 25–50 ms, one 125 ms outlier in run 3.
- Evidence: [`notes/evidence/2026-09-27-local-50k-explain.out`](evidence/2026-09-27-local-50k-explain.out) (fifth post-change run); ranges in [`docs/verification.md`](../docs/verification.md#50k-query-plan-evidence).
- Decision: keep indexes unchanged; the fix was a predicate rewrite, not a new index. PR aggregation remains the known scale limit.
