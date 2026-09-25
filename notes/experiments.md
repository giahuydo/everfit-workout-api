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

## 50k query-plan verification — blocked locally

- Date: 2026-09-25
- Git state: `perf/50k-evidence` (uncommitted evidence harness at time of attempt)
- Question being tested: whether the two existing `workout_entries` indexes are sufficient for representative history and all three personal-record query shapes before proposing another index.
- Dataset shape specified by the harness: one user, exactly 50,000 entries, 2–5 sets/entry, seven exercised catalog entries, date distribution of 65% in the most recent 90 days / 25% in the prior 640 days / 10% older, and two exercises with null muscle metadata.
- Command attempted: `docker compose ps && docker compose up -d postgres`.

### Result

- The local Docker daemon could not be reached: `permission denied while trying to connect to the docker API at unix:///Users/dogiahuy/.orbstack/run/docker.sock`.
- `psql` and `pg_isready` are installed, but no reachable local PostgreSQL instance was available through the configured compose service after that failure.
- Therefore no `EXPLAIN (ANALYZE, BUFFERS)` plan, row count, latency, cache state, or throughput value was recorded. In particular, this experiment makes **no** 10k-concurrent-throughput claim.

### Decision

- Keep the existing indexes unchanged: `idx_workout_entries_user_cursor`, `idx_workout_entries_user_exercise_date`, the exercises normalized-name unique index, and the workout-set entry/order unique index.
- Why: a leading-wildcard partial-name filter remains an index hypothesis, but the unavailable database means there is no measured evidence supporting `pg_trgm`, expression, or additional PR-ranking indexes. Adding one would be speculative.
- Reproduction: after creating the local application schema, run `DATABASE_URL=postgresql://everfit:everfit@127.0.0.1:55432/everfit scripts/perf/run-50k-evidence.sh`. Commit `notes/evidence/seed-50k.out` and `notes/evidence/explain-50k.out` only when produced by that command; then replace this blocked result with the observed plans.
- Disproved assumptions: the environment did not support the assumption that a Docker-managed local Postgres could be started; no assumption about query performance was tested or disproved.
