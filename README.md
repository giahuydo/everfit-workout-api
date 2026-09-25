# Everfit Workout API

NestJS and PostgreSQL API for workout logging, history, and personal records.

```text
HTTP/JSON → NestJS controllers → services → PostgreSQL
                              ├─ exercises (shared configurable catalog)
                              ├─ workout_entries
                              └─ workout_sets
```

## Run locally

Prerequisites: Node.js, pnpm, Docker, and a `DB_PASSWORD` environment value for Compose.

```sh
cp .env.example .env
pnpm install
pnpm migration:run
pnpm start:dev
```

For Compose, the `migrate` service applies versioned migrations before `app` starts:

```sh
DB_PASSWORD=choose-a-local-password docker compose up --build
```

PostgreSQL is exposed on `55432`; the API listens on `3100` with `.env`. Health endpoints are `/health`, `/health/live`, and `/health/ready`; OpenAPI and Scalar are at `/docs` and `/reference`.

Schema synchronization is disabled by default (`DB_SYNCHRONIZE=false`). Migrations own schema changes; `synchronize=true` is only an explicit disposable-local escape hatch, not a production setup.

```sh
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
pnpm migration:show
pnpm migration:run
```

`test` runs the contract/unit suite. `test:e2e` is separate and requires the local PostgreSQL configuration. The workflow suite boots with `DB_SYNCHRONIZE=true` for speed; `test/migrations.e2e-spec.ts` (also runnable alone via `pnpm test:e2e:migrations`) recreates a fresh database, applies the single versioned initial migration, and runs a representative log/history/PR flow with `DB_SYNCHRONIZE=false`.

## API behavior

`userId` is an opaque route parameter, not authentication.

### Create workouts

`POST /v1/users/:userId/workouts`

```json
{
  "date": "2026-09-25",
  "exercises": [{
    "exerciseName": "Bench Press",
    "sets": [{"reps": 5, "weight": 100, "unit": "kg"}]
  }]
}
```

Workout dates are validated `YYYY-MM-DD` values and stored as PostgreSQL `DATE`. `created_at` is a UTC ingestion timestamp, never a claimed workout time. Input weights remain JSON numbers; the service stores submitted original values plus decimal-safe canonical kg (`NUMERIC`), with `1 lb = 0.45359237 kg`. The whole request is transactional. The response has one entry per submitted exercise occurrence and preserves submitted weight/unit values.

The shared exercise catalog (name → muscle group) is data in `config/exercises.json`, loaded and validated at startup; set `EXERCISE_CATALOG_PATH` to use another file. Entries are `{"name": string, "muscleGroup": string | null}`; startup fails on blank or over-long names, invalid muscle groups, or duplicate normalized names. Seeding inserts missing exercises only and never overwrites metadata already in the database, so changing an existing row's muscle group requires a database update. There is intentionally no catalog-admin endpoint.

Supported weight units come from the shared `WEIGHT_UNITS` registry and kg factors in `src/units/units.service.ts`; request and query DTOs validate against that registry, so adding a unit such as stone is a registry-plus-factor change.

### History

`GET /v1/users/:userId/workouts?exerciseName=bench&from=2026-09-01&to=2026-09-30&unit=lb&limit=20`

History filters by user, inclusive date range, literal partial normalized exercise name, and optional muscle group. It orders entries by `(workout_date DESC, created_at DESC, id DESC)`. The opaque cursor includes the filter scope and a six-digit UTC microsecond timestamp; invalid or mismatched cursors return `400`.

```json
{
  "items": [{
    "id": "entry-uuid",
    "exerciseName": "Bench Press",
    "muscleGroup": "Chest",
    "date": "2026-09-25",
    "createdAt": "2026-09-25T12:30:00.123456Z",
    "sets": [{"id": "set-uuid", "reps": 5, "weight": 220.462, "unit": "lb"}]
  }],
  "page": {"limit": 20, "hasMore": false, "nextCursor": null}
}
```

A valid empty page is `200`, with the same `items` and `page` shape plus `message: "No workouts found for the requested filters"`. Pagination is not snapshot-consistent across concurrent writes.

### Personal records

`GET /v1/users/:userId/personal-records?exerciseName=Bench%20Press&unit=kg`

The exact normalized exercise-name lookup independently selects `heaviestSet`, `highestVolume`, and `estimatedOneRepMax`; each winning object has `achievedDate`. Volume and Epley 1RM are calculated against persisted canonical kg before display conversion. A valid no-data query returns `200`, all three fields `null`, and an explanatory message. `/personal-records/compare` returns those same independent records for explicit `rangeA` and `rangeB`, with per-range no-data messages.

### Runtime safeguards

The service caps request bodies at 256 KiB, validates configuration before database connection, emits request IDs, returns a structured error envelope, redacts sensitive logs, handles `SIGTERM`/`SIGINT`, and exposes liveness/readiness endpoints.

## Schema and performance evidence

The migration creates the normalized exercise catalog, entries, ordered sets, foreign keys, numeric precision, and history indexes. On 2026-09-26 local time, a fresh PostgreSQL 16-alpine container on port 55433 accepted the versioned migration from an empty database: `pnpm migration:run` succeeded and `pnpm migration:show` reported `[X] 1 InitialSchema1770000000000`.

### Measured 50k evidence

The migrated database accepted the 50k harness: 50,000 workout entries, 174,823 sets, seven exercised names, dated 2022-09-27 through 2026-09-25. In one local warm-ish verification run, `EXPLAIN (ANALYZE, BUFFERS)` measured 0.179 ms for the unfiltered first history page, 0.075 ms for a filtered partial-name/date/muscle page, 7.359 ms for a deep keyset page after row 25,001, 30.783 ms for heaviest-set PR, 31.498 ms for highest-volume PR, and 34.247 ms for estimated 1RM. Existing indexes were used for history and user/exercise/date filtering.

These are query-plan timings from one local verification run, not throughput measurements or general production-latency claims. They were measured with the earlier `LIMIT 51` history lookahead and PR ties ending at `set_order`; the current harness uses the service’s `LIMIT 21` lookahead and final `ws.id` tie key and has not been remeasured. `pnpm test:e2e` passed 19 tests in one file after the fixes; `pnpm test` passed 9 tests in three files. The harness remains available at `scripts/perf/run-50k-evidence.sh` for a migrated local PostgreSQL database.

## Trade-offs

- No authentication or authorization is included by assignment scope.
- Catalog muscle-group changes affect later history filtering of older entries.
- The cursor scope hash detects query mismatch but does not sign or authorize a cursor.
- No cache, queue, search service, or admin API is included; add them only with an evidenced need.

See [AI workflow](AI_WORKFLOW.md) for evidenced AI review/corrections and [API contract](docs/api-design.md) for the detailed frozen behavior.
