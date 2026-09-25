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
