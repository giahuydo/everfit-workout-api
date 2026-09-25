# Everfit Workout API

NestJS and PostgreSQL service for recording workouts, browsing a user's history, and calculating personal records (PRs). This README describes the code currently in this repository; where the design notes promise behavior not yet evidenced or not yet implemented, it says so.

## Architecture

```text
client
  | HTTP / JSON
  v
NestJS controllers ──> WorkoutsService ──> TypeORM / SQL ──> PostgreSQL
                     |       |                    |
                     |       |                    +-- exercises (shared normalized identity)
                     |       +-- UnitsService     +-- workout_entries
                     |            kg <-> lb       +-- workout_sets
                     v
                 PersonalRecordsService
                 (three independent ranked SQL queries)
```

`WorkoutsService` validates the route user ID and calendar date, writes each request in one database transaction, normalizes exercise identity, and stores both submitted and canonical weight. `PersonalRecordsService` performs separate SQL ranking queries for heaviest set, volume, and Epley estimated 1RM. `UnitsService` uses `decimal.js`, with `1 lb = 0.45359237 kg`, to avoid binary-float conversion errors.

The live entity model is `exercises` → `workout_entries` → `workout_sets`. Exercise names are globally unique after trim/lowercase normalization; repeated workout entries for the same user/exercise/day are allowed. This is deliberately a single service: no queues, cache, or search service is present.

## Run locally

Prerequisites: Node.js/pnpm and Docker (for PostgreSQL).

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm start:dev
```

The API listens on `http://localhost:3100` with the supplied `.env`; use `GET /health` to check the database connection. Swagger UI is available at `/docs` and Scalar reference at `/reference` after startup.

The compose file starts PostgreSQL 16 on host port `55432`. The current development default, `DB_SYNCHRONIZE=true`, lets TypeORM create the entity schema. That is convenient for this draft but is not a production migration strategy; no versioned migrations are present yet.

Useful commands:

```sh
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

No test files or recorded test run are currently present, so these commands are instructions, not claims of a passing suite.

## API

`userId` is an opaque path value only; it is not authentication or authorization.

### Log workouts

```sh
curl -X POST http://localhost:3100/v1/users/coach-42/workouts \
  -H 'content-type: application/json' \
  -d '{
    "date":"2026-09-25",
    "exercises":[{
      "exerciseName":"Bench Press",
      "sets":[
        {"reps":5,"weight":100,"unit":"kg"},
        {"reps":8,"weight":80,"unit":"lb"}
      ]
    }]
  }'
```

Success is `201` with `entries`; each set retains its submitted display unit on this endpoint. The UUIDs are generated at runtime:

```json
{"entries":[{"id":"<entry-id>","exerciseName":"Bench Press","muscleGroup":null,"date":"2026-09-25","sets":[{"id":"<set-id>","position":1,"reps":5,"weight":100,"unit":"kg"}]}]}
```

The DTO requires 1–50 exercises, 1–50 sets per exercise, integer reps 1–10,000, finite weight 0–100,000 with at most three decimal places, and `kg` or `lb`. The whole request is transactional: a failure rolls back its entries and sets.

### History

```sh
curl 'http://localhost:3100/v1/users/coach-42/workouts?exerciseName=bench&from=2026-09-01&to=2026-09-30&unit=lb&limit=20'
```

History filters by user, inclusive calendar dates, a literal escaped substring of normalized exercise name, and optional muscle group. It orders by workout date, then ingestion timestamp, then ID, and encodes those values plus effective filters into an opaque cursor. Weights are converted from stored canonical kg for the requested output unit.

The implemented response uses `pageInfo.nextCursor`; it does **not** currently expose `hasMore` or a page limit:

```json
{"items":[],"pageInfo":{"nextCursor":null},"message":"No workouts found for the requested range."}
```

This valid empty result is `200`, not an error. The cursor's SHA-256 scope hash detects mismatched query parameters; it is not signed and provides no tamper protection.

### Personal records and comparison

```sh
curl 'http://localhost:3100/v1/users/coach-42/personal-records?exerciseName=Bench%20Press&from=2026-09-01&to=2026-09-30&unit=kg'

curl 'http://localhost:3100/v1/users/coach-42/personal-records/compare?exerciseName=Bench%20Press&rangeAFrom=2026-08-01&rangeATo=2026-08-31&rangeBFrom=2026-09-01&rangeBTo=2026-09-30&unit=kg'
```

The service ranks each metric independently on persisted `weight_kg`: heaviest weight, `reps * weight_kg` volume, and Epley `weight_kg * (1 + reps / 30)`. Ties use ascending workout date, ingestion time, entry ID, and set order. A no-data PR query returns `200` with `records` values set to `null` and a message:

```json
{"exerciseName":"Bench Press","unit":"kg","range":{"from":"2026-09-01","to":"2026-09-30"},"records":{"heaviest":null,"highestVolume":null,"estimated1RM":null},"message":"No workout data found for the requested range."}
```

### Errors

Nest's default validation/exception response is currently used. Invalid input returns `400` (for example, unsupported units, invalid dates, invalid ranges, or invalid cursors). A stable custom envelope with application error codes and request IDs is **not implemented or evidenced**; the richer envelope in [`docs/api-design.md`](docs/api-design.md) is a proposed contract, not a guarantee of the current service.

## Schema and indexes

The current entities declare:

- `exercises.normalized_name` unique index, for globally shared exercise identity.
- `workout_entries(user_id, workout_date, created_at, id)`, supporting user-history ordering.
- `workout_entries(user_id, exercise_id, workout_date, created_at, id)`, supporting an exercise-scoped path.
- `workout_sets(workout_entry_id, set_order)` unique index, preserving per-entry set order.

`workout_sets` stores `original_weight`, `original_unit`, and `weight_kg` (`NUMERIC(15,6)`). Canonical kg makes cross-unit PR ranking consistent; retaining original input makes logging responses and auditing intelligible. The index rationale is design-based. There is no `EXPLAIN (ANALYZE, BUFFERS)` record to prove plans or index benefit yet. See [`docs/database-design.md`](docs/database-design.md) for the proposed full schema rationale.

## Date and timezone policy

Workout `date` is a client-provided `YYYY-MM-DD` calendar day stored as PostgreSQL `DATE`; the service validates it and does not turn it into midnight UTC. `created_at` is a UTC `TIMESTAMPTZ` ingestion timestamp, used to make same-day ordering deterministic, not to claim a workout time. This avoids changing a user's workout day during timezone conversion but cannot represent actual time-of-day or client offset. See [ADR 003](docs/decisions/003-workout-date-and-timezone.md).

## Trade-offs and submission evidence

- No auth: route `userId` is not an access-control boundary.
- Cursor pagination avoids deep-offset scans but is not snapshot-consistent; inserts and catalog metadata changes can alter later pages.
- Muscle-group metadata is nullable and no seed/configured catalog behavior is demonstrated in the current implementation.
- PostgreSQL is used through TypeORM synchronization in this draft; production migrations, runtime configuration validation, and a service Docker image remain pending.
- The design target discusses 50,000+ entries per user, but [`notes/experiments.md`](notes/experiments.md) records only planned experiments. No 50k dataset, query plan, latency result, or capacity measurement is available. Do not read the indexes as measured performance evidence.

For 10,000 concurrent coaches, this repository makes no capacity claim. A future design review would first load-test the actual queries and connection pool, then consider stateless API replicas, pool sizing/backpressure, read replicas for read-heavy traffic, cache/projection choices, and possibly partitioning only if measured data warrants them.

## 15–20 minute English video walkthrough checklist (recording pending)

No recording or link is claimed. A reviewer can use this outline to record one:

1. 0:00–2:00 — scope, run the service, `/health`, and docs UI.
2. 2:00–5:00 — architecture, entity relationships, PostgreSQL choice, and transaction flow.
3. 5:00–8:00 — log a mixed-unit workout; explain canonical/original weight handling.
4. 8:00–11:00 — history filters, cursor behavior, date/timezone semantics, and empty `200` response.
5. 11:00–14:00 — PR and comparison requests; explain the three metric formulas and deterministic ties.
6. 14:00–16:00 — invalid request, transaction rollback intent, known error-envelope gap, and no-data behavior.
7. 16:00–18:00 — index rationale, the unmeasured 50k evidence gap, and 10k-coach options as future design only.
8. 18:00–20:00 — walk through [`AI_WORKFLOW.md`](AI_WORKFLOW.md), including its evidence gaps; do not claim missing AI case studies or a recording.

## Further design records

- [Architecture](docs/architecture.md)
- [API design (planned contract)](docs/api-design.md)
- [Database design (planned)](docs/database-design.md)
- [Decision records](docs/decisions)
