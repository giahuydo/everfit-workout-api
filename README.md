# Everfit Workout API

NestJS and PostgreSQL API for workout logging, history, and personal records.

```text
HTTP/JSON → NestJS controllers → services → PostgreSQL
                              ├─ exercises (shared configurable catalog)
                              ├─ workout_entries
                              └─ workout_sets
```

## Run locally

Prerequisites: Node.js 22, pnpm 10.28.2 (pinned in `package.json` and the Docker build), and Docker.

### Option A: everything in Compose (reproducible path)

```sh
DB_PASSWORD=choose-a-local-password docker compose up --build
```

Compose starts `postgres`, runs the one-shot `migrate` service (versioned migrations), and only then starts `app`. The API listens on `http://localhost:3000` (or `PORT` from the environment/`.env`, e.g. 3100 after `cp .env.example .env`); PostgreSQL is published on `localhost:55432`.

### Option B: API on the host, PostgreSQL in Docker

```sh
cp .env.example .env              # DB on 127.0.0.1:55432, API on port 3100, DB_PASSWORD=everfit
docker compose up -d postgres     # start only PostgreSQL; Compose reads DB_PASSWORD from .env
pnpm install
pnpm migration:run                # apply versioned migrations
pnpm start:dev                    # http://localhost:3100
```

`pnpm start:dev` does not start a database; PostgreSQL must be running and migrated first. Stop it with `docker compose down` (add `-v` to delete the local volume).

On startup the app inserts any missing rows from the exercise catalog. That insert relies on database-generated UUID defaults, which the versioned migration `InitialSchema1770000000000` creates (`uuid-ossp` extension plus `uuid_generate_v4()` defaults on every primary key). A local database migrated with an earlier revision of that same migration, before the defaults were added, still records it as applied but has no defaults, so startup fails with `null value in column "id" of relation "exercises"`. Recreate such a database (`docker compose down -v`) rather than re-running migrations.

Health endpoints are `/health`, `/health/live`, and `/health/ready`; OpenAPI and Scalar are at `/docs` and `/reference`.

Schema synchronization is disabled by default (`DB_SYNCHRONIZE=false`). Migrations own schema changes; `synchronize=true` is only an explicit disposable-local escape hatch, not a production setup.

```sh
pnpm build
pnpm lint
pnpm test          # contract/unit suite, no database
pnpm test:e2e      # DB-backed suite; needs the local PostgreSQL configuration
pnpm migration:show
```

`pnpm test:e2e` runs both DB-backed files and needs the local PostgreSQL configuration (`DB_*`, default `127.0.0.1:55432`). Each file drops and recreates its own database on every run (`everfit_workflows_test`, or `E2E_DB_NAME`; `everfit_migrations_test`, or `E2E_MIGRATIONS_DB_NAME`), so do not point these variables at a database you want to keep. The workflow suite (`test/workout-workflows.e2e-spec.ts`) builds its schema with `DB_SYNCHRONIZE=true` for speed. `test/migrations.e2e-spec.ts` (also runnable alone via `pnpm test:e2e:migrations`) applies the versioned migration to its fresh database and runs a representative log/history/PR flow with `DB_SYNCHRONIZE=false`.

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

`201` response (one entry per submitted exercise occurrence; sets echo the submitted weight/unit):

```json
{"entries": [{"id": "entry-uuid", "exerciseName": "Bench Press", "date": "2026-09-25",
  "sets": [{"id": "set-uuid", "reps": 5, "weight": 100, "unit": "kg"}]}]}
```

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
    "muscleGroup": "chest",
    "date": "2026-09-25",
    "createdAt": "2026-09-25T12:30:00.123456Z",
    "sets": [{"id": "set-uuid", "reps": 5, "weight": 220.462, "unit": "lb"}]
  }],
  "page": {"limit": 20, "hasMore": false, "nextCursor": null}
}
```

A valid empty page is `200`, with the same `items` and `page` shape plus `message: "No workouts found for the requested filters"`. Pagination is not snapshot-consistent across concurrent writes.

### Personal records

`GET /v1/users/:userId/personal-records?exerciseName=Bench%20Press&from=2026-09-01&to=2026-09-30&unit=kg`

`exerciseName` is an exact normalized lookup (trim + lowercase), unlike the history substring filter. `heaviestSet`, `highestVolume`, and `estimatedOneRepMax` are selected independently, so they can come from different sets. Volume (`reps × weight`) and Epley 1RM (`weight × (1 + reps/30)`) are ranked on persisted canonical kg before display conversion. Ties go to the earliest `workout_date`, then `created_at`, entry id, set order, and set id.

Response after logging `5 × 120 kg` and `8 × 225 lb` on 2026-09-10 (IDs shortened):

```json
{
  "heaviestSet":        {"entryId": "83ec…", "setId": "6f9a…", "reps": 5, "weight": 120,     "unit": "kg", "value": 120,     "valueUnit": "kg",      "achievedDate": "2026-09-10"},
  "highestVolume":      {"entryId": "83ec…", "setId": "c747…", "reps": 8, "weight": 102.058, "unit": "kg", "value": 816.466, "valueUnit": "kg·reps", "achievedDate": "2026-09-10"},
  "estimatedOneRepMax": {"entryId": "83ec…", "setId": "6f9a…", "reps": 5, "weight": 120,     "unit": "kg", "value": 140,     "valueUnit": "kg",      "achievedDate": "2026-09-10"}
}
```

A valid query with no matching sets (unknown exercise or empty range) returns `200`: `{"heaviestSet": null, "highestVolume": null, "estimatedOneRepMax": null, "message": "No personal records found for the requested range"}`.

### Compare personal records across ranges

`GET /v1/users/:userId/personal-records/compare?exerciseName=Bench%20Press&rangeAFrom=2026-09-01&rangeATo=2026-09-30&rangeBFrom=2026-07-01&rangeBTo=2026-07-31&unit=kg`

All four bounds are required and inclusive; the caller supplies month boundaries. Each range is computed independently with the same rules. An empty range still returns `200`, with null records and a per-range `message`:

```json
{
  "rangeA": {"from": "2026-09-01", "to": "2026-09-30", "records": {
    "heaviestSet": {"reps": 5, "weight": 120, "unit": "kg", "value": 120, "valueUnit": "kg", "achievedDate": "2026-09-10", "entryId": "83ec…", "setId": "6f9a…"},
    "highestVolume": {"…": "same shape as above"},
    "estimatedOneRepMax": {"…": "same shape as above"}}},
  "rangeB": {"from": "2026-07-01", "to": "2026-07-31",
    "records": {"heaviestSet": null, "highestVolume": null, "estimatedOneRepMax": null},
    "message": "No personal records found for this range"}
}
```

### Errors

Every error uses one envelope. Invalid bodies, query parameters, date ranges, units, and cursors return `400` with `code: "VALIDATION_ERROR"`. Oversized bodies return `413 PAYLOAD_TOO_LARGE`, and unexpected failures return `500 INTERNAL_SERVER_ERROR` with `details: null` and no stack trace. `requestId` echoes a valid `x-request-id` header or is a generated UUID. For example, a set submitted with `"unit": "stone"` returns:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": ["exercises.0.sets.0.unit must be one of the following values: kg, lb"],
  "requestId": "demo-400"
}
```

A bulk request that fails validation commits nothing.

The request/response examples above were captured on 2026-09-26 from a local run of an earlier revision, against a freshly migrated database with UUID defaults applied; they were not re-captured after the final integration. Only the IDs were shortened and the compare `rangeA` body abbreviated.

### Runtime safeguards

The service caps request bodies at 256 KiB, validates configuration before database connection, emits request IDs, returns a structured error envelope, redacts sensitive logs, handles `SIGTERM`/`SIGINT`, and exposes liveness/readiness endpoints.

## Schema and performance evidence

The migration creates the normalized exercise catalog, entries, ordered sets (`set_order`, unique per entry), UUID primary-key defaults, foreign keys, numeric precision, and history indexes. Before the UUID defaults were added, a fresh PostgreSQL 16-alpine container on port 55433 accepted the versioned migration from an empty database: `pnpm migration:run` succeeded and `pnpm migration:show` reported `[X] 1 InitialSchema1770000000000`. The current migration is exercised on every `pnpm test:e2e` run by `test/migrations.e2e-spec.ts` (fresh database, `DB_SYNCHRONIZE=false`, nothing pending afterwards).

### Measured 50k evidence (one local query-plan run)

The migrated database accepted the 50k harness: one user with 50,000 workout entries and 174,823 sets across seven distinct exercises, dated 2022-09-27 through 2026-09-25. `EXPLAIN (ANALYZE, BUFFERS)` execution times:

| Query shape | Time |
| --- | --- |
| History, unfiltered first page | 0.179 ms |
| History, partial name + date + muscle group | 0.075 ms |
| History, deep keyset page after row 25,001 | 7.359 ms |
| PR heaviest / highest volume / estimated 1RM | 30.783 / 31.498 / 34.247 ms |

Evidence is kept verbatim in [`notes/evidence/`](notes/evidence/README.md), with analysis in [`notes/experiments.md`](notes/experiments.md). Limitations of this evidence:

- **Scope:** these numbers come from one local warm-ish query-plan run (2026-09-25 23:57 +07:00). They are not HTTP endpoint latency, throughput, or a repeated benchmark, and they say nothing about capacity for 10k concurrent coaches.
- **Deep pages:** the keyset `OR` predicate runs as an index filter, not an index bound. The deep page removed 25,001 rows and touched 25,386 buffers to return 51, so cost grows with page depth.
- **PR queries:** these use an index to select entries but a parallel sequential scan over all of the user's `workout_sets`, so cost grows with total set count.
- **Representative SQL:** `scripts/perf/explain-50k.sql` hand-writes equivalents of the service queries rather than capturing the SQL the app emits. The recorded run used the script's earlier shape (`LIMIT 51` history lookahead, PR ties ending at `set_order`). The script now uses the service's `LIMIT 21` lookahead and final `ws.id` tie key, and it has not been remeasured.

The indexes were kept unchanged because these plans were acceptable at the 50k target. The seed supplies explicit IDs, so the later UUID-default change to the migration does not affect these plans. The harness `scripts/perf/run-50k-evidence.sh` can be rerun against any migrated local database.

### Test evidence

Verified on this branch on 2026-09-26: `pnpm build` passed; `pnpm lint` reported 0 warnings and 0 errors; `pnpm test` passed 34/34 tests in 7 files; `pnpm test:e2e` passed 21/21 tests in 2 DB-backed files; and `pnpm test:e2e:migrations` passed 2/2. A clean Compose build also passed after pinning pnpm 10.28.2; the one-shot migration service exited 0, `/health/live` and `/health/ready` returned 200, and a POST workout smoke request returned 201.

An earlier run (9 unit tests, 19 workflow e2e tests) passed while startup on a migrated database failed, because the workflow suite builds its schema with `DB_SYNCHRONIZE=true` and so checks the entity model rather than the migrated schema. The migration-backed e2e file and a migration unit test now cover that path. The workflow suite also used to reuse its test database if it already existed; it now drops and recreates it on every run, so leftover schema or rows from earlier runs cannot affect results.

## Trade-offs

- No authentication or authorization is included by assignment scope.
- Catalog muscle-group changes affect later history filtering of older entries.
- The cursor scope hash detects query mismatch but does not sign or authorize a cursor.
- No cache, queue, search service, or admin API is included; add them only with an evidenced need.

See [AI workflow](AI_WORKFLOW.md) for evidenced AI review/corrections, [API contract](docs/api-design.md) for detailed behavior, [ADRs](docs/decisions/001-postgresql.md) for decisions, and [video checklist](docs/video-walkthrough-checklist.md) for the planned walkthrough (not yet recorded).
