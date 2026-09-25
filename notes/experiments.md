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

## 50k query-plan verification — measured

- Date: 2026-09-26 local time
- Git state: `integration/final`
- Question being tested: whether the two existing `workout_entries` indexes are sufficient for representative history and all three personal-record query shapes before proposing another index.
- Dataset shape: 50,000 workout entries, 174,823 sets, seven exercised names, dates 2022-09-27 through 2026-09-25.
- Environment: fresh PostgreSQL 16-alpine container on port 55433; one local warm-ish verification run.
- Migration verification: the versioned migration succeeded from an empty database with `pnpm migration:run`; `pnpm migration:show` returned `[X] 1 InitialSchema1770000000000`.
- Evidence: `/tmp/everfit-perf-evidence/explain-50k.out`.

### Result

- The 50k harness completed successfully on the migrated database.
- `EXPLAIN (ANALYZE, BUFFERS)` execution times: unfiltered first history page 0.179 ms; filtered partial-name + date + muscle page 0.075 ms; deep keyset page after row 25,001 7.359 ms; heaviest-set PR 30.783 ms; highest-volume PR 31.498 ms; estimated 1RM 34.247 ms.
- Existing indexes were used for history and user/exercise/date filtering.
- The deep keyset page's OR predicate scanned 25,001 prior rows.
- This is one local warm-ish verification run only; it does not establish throughput or general production latency.

### Decision

- Keep the existing indexes unchanged: `idx_workout_entries_user_cursor`, `idx_workout_entries_user_exercise_date`, the exercises normalized-name unique index, and the workout-set entry/order unique index.
- Why: current measured plans were acceptable for the assignment scale, so no extra trigram or PR-ranking index was added. The deep-page OR predicate is a possible future optimization because it scanned 25,001 prior rows, but it is not a blocker.
- Earlier agent reports that migration and performance verification were blocked accurately described their sandbox's local TCP/Docker restriction; that environmental claim is stale for the human/orchestrator environment that produced this run.
