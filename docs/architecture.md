# Architecture

- **Audience:** engineers reviewing or extending the service.
- **Goal:** understand the system shape and the reasons behind it before reading endpoint or SQL details.

## The shape of the system

The take-home is intentionally one stateless NestJS service backed by PostgreSQL. The application layer owns validation and use-case orchestration; PostgreSQL owns durable state, transactional writes, filtering, and PR ranking.

```text
                         COACH / CLIENT APP
                                │
                                │ HTTP / JSON
                                ▼
╔═══════════════════════ NESTJS API ═══════════════════════╗
║                                                         ║
║  WorkoutsController          PersonalRecordsController  ║
║          │                              │               ║
║          ▼                              ▼               ║
║   WorkoutsService              PersonalRecordsService   ║
║          │                              │               ║
║          ├──────── UnitsService ────────┤               ║
║          │                                              ║
║          └──── validation · transactions · SQL queries  ║
╚════════════════════════════╦════════════════════════════╝
                             │ TypeORM / SQL
                             ▼
╔════════════════════════ POSTGRESQL ══════════════════════╗
║                                                         ║
║  exercises  ───────►  workout_entries  ───────► sets   ║
║  identity + metadata   user/date/exercise        reps   ║
║                                               weights   ║
╚═════════════════════════════════════════════════════════╝
```

The design deliberately does **not** add Redis, queues, search infrastructure, or microservices without a requirement or measurement that needs them.

## Business flow

The stored workout sets are the source data; history and PRs are read models derived from them.

```text
client completes workout
        │
        ▼
   log workout
        │
        ├────────► workout history ─────► coach reviews activity
        │
        └────────► personal records ────► compare periods ────► coach sees progress
```

This is why the service has a small write path and richer read/query behavior rather than separate state for history or PRs.

## Module responsibilities

| Area | Responsibility |
| --- | --- |
| `workouts` | Atomic bulk logging, history filters, keyset pagination, exercise resolution |
| `personal-records` | Query DTOs, read-only heaviest-set/volume/Epley 1RM calculations, and range comparison |
| `units` | Central kg/lb registry, canonical conversion, response formatting |
| exercise catalog | Shared exercise identity plus configurable muscle-group metadata |
| `common` / `config` | Date/name helpers, validation, errors, request IDs, runtime configuration |
| database migration | Tables, constraints, indexes, UUID defaults; schema source of truth |

`AppModule` imports `WorkoutsModule`, which registers both the workout and personal-records controllers/services. This is one Nest module with two feature directories, not a separate `PersonalRecordsModule`. Workout entities and persistence remain under `workouts/entities/`; PRs are a computed read model over those tables, with no PR entity, table, or stored aggregate. The PR endpoint DTOs live under `personal-records/dto/`.

OpenAPI error-envelope helpers shared by both features live in `common/openapi-responses.ts`; feature-specific success schemas and examples live in each feature's `*.openapi-examples.ts`, with decorators in `*.openapi.ts`. Swagger UI is served at `/docs` and Scalar at `/reference`. Controllers stay thin; services own use cases. Unit conversion is centralized rather than repeated in endpoint code.

## Write flow

```text
POST workout
    │
    ▼
validate route + body
    │
    ▼
normalize exercise names
    │
    ▼
BEGIN TRANSACTION
    │
    ├─ resolve/create shared exercises safely
    ├─ convert each submitted weight to canonical kg
    ├─ insert workout entries
    └─ insert ordered sets
    │
    ▼
COMMIT → return original submitted values
```

One request is one transaction. A validation or persistence failure leaves no partial workout behind. Repeated same-day exercise occurrences remain separate entries; there is no deduplication or idempotency promise in this scope.

## Read flows

### Workout history

History filters **entries** in PostgreSQL before pagination. The service selects a page of entry IDs using `(workout_date, created_at, id)`, then loads the ordered sets for those entries. Joined set rows are never paginated directly.

```text
filters → indexed entry query → keyset page → load sets → convert display unit → response
```

### Personal records

PR lookup resolves one exact normalized exercise name, then asks PostgreSQL to rank candidate sets independently for:

- heaviest weight;
- highest `reps × weight` volume;
- highest Epley `weight × (1 + reps/30)` estimate.

Winner selection happens on persisted canonical kg. Output-unit conversion happens only after the winning row is known.

## Time model

`workout_date` is the calendar day supplied by the caller and is stored as PostgreSQL `DATE`. `created_at` is UTC ingestion time (`TIMESTAMPTZ(6)`), not workout time. The API never invents midnight UTC or a client timezone that was not supplied.

This keeps the model faithful to the assignment while still providing deterministic same-day pagination.

## Operational boundaries

- Request body: 256 KiB maximum.
- Bulk logging: at most 50 exercises/request and 50 sets/exercise.
- Exercise name: 120 characters maximum after normalization.
- User ID: 128 characters maximum.
- History page: default 20, maximum 100.
- Production schema synchronization is rejected; versioned migrations own schema changes.
- Readiness checks include database connectivity; liveness only checks the process.
- `userId` is an opaque route parameter, not authentication. A real product deployment needs identity and authorization.

## Scaling stance

The design targets histories of 50k+ entries per user. One recorded 50k-entry run provides limited SQL query-plan evidence (on an earlier query shape), not a current HTTP benchmark or a claim of 10k concurrent-user capacity.

If measured load later requires more capacity, the next steps would be evidence-driven: stateless API replicas, explicit connection-pool control/PgBouncer, query/index improvements, read replicas or cached/projection reads for hot PR workloads, and only then more complex infrastructure.

## Related docs

- [API design](api-design.md)
- [Database design](database-design.md)
- [ADRs](decisions/)
- [Measured query plans](../notes/experiments.md)
