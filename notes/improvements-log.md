# Everfit improvement ledger (internal; not a submission artifact)

Internal working notes. They are not part of the README/AI_WORKFLOW submission and make no claims beyond the cited evidence. The Everfit assignment and the [A01–A102 traceability](requirement-traceability.md) (now a historical snapshot) remain the ground truth for requirements. Log only additive, business-appropriate improvements, checked in this order: requirement coverage, then correctness, then additive quality, avoiding unnecessary over-engineering. Never weaken a requirement or claim that a proposal is implemented.

**Status values**
- `proposed`: not in the code on this branch.
- `applied`: the cited code or artifact exists on this branch, but no test or measurement specifically covers it.
- `verified`: covered by the 2026-09-26 passing run on this branch (`pnpm build` pass, `pnpm lint` 0 warnings/0 errors, `pnpm test` 32/32 in 6 files, `pnpm test:e2e` 21/21 in 2 files, `pnpm test:e2e:migrations` 2/2), the local migration run, or the recorded 50k evidence in [`notes/evidence/`](evidence/README.md).
- `open`: a known defect or gap.
- `rejected`: considered and deliberately not done.

Re-reconciled on 2026-09-26 against branch `final/docs-v2`, which contains `f611fd3` (JSON catalog, shared unit registry), `a920c68` (UUID defaults), `559d630` (PR volume rounding, PostgreSQL UUID cursors, migration-backed e2e, perf SQL parity), and `a5046ed` (workflow e2e database recreated per run). No row below depends on an unmerged branch.

Attributable AI mistakes and rejections belong in [the AI error/rejection ledger](ai-findings.md), not here. An improvement row is not AI-mistake evidence.

## Original rows, reconciled

| Improvement | Source/reviewer | Related requirements | Status | Current evidence | Remaining risk / notes |
|---|---|---|---|---|---|
| Keyset cursor `(workout_date, created_at, id)` rather than offset | Lead design; Pi review | A14, A32, A40, A44 | **verified** | `src/workouts/workouts.service.ts` selects `created_at` via `to_char(... 'US')`, so the six-digit microseconds survive (IR-04 resolved). Tests: `api-contract-validation.spec.ts` "only accepts exact, UTC microsecond cursor keys"; e2e cursor page-shape, exhausted-page, and malformed/mismatch tests; 50k deep-page plan | Not a snapshot. **Deep pages scan earlier rows** (25,001 rows filtered at depth 25k). Row-value predicate is `proposed` below |
| SQL-filtered literal partial-name history plus entry-first paging | Lead design; Pi review | A09–A14, A40, A45 | **verified** | e2e "filters history by literal partial name, inclusive dates, and current muscle group"; 50k filtered plan 0.075 ms | Leading-wildcard `LIKE` has no index. It was acceptable at 7 catalog names but untested with a large catalog |
| Atomic bulk transaction, conflict-safe shared exercise identity, same-day repeats | Lead design; Pi review | A08, A31, A53 | **verified** (atomicity, concurrency); **applied** (lock ordering) | e2e rollback, concurrent same-user writes, and concurrent first-use single-exercise tests. `log()` now resolves names in sorted order (IR-05 mitigation) | No dedicated opposite-order deadlock regression test |
| Decimal-safe kg storage and canonical-kg SQL PR winner selection | Lead design; Pi review | A05–A07, A15–A17, A41, A50–A51 | **verified** | e2e six-decimal canonical kg and conversion tests; e2e mixed-unit and tie PR test; `api-contract-validation.spec.ts` "computes highestVolume from exact canonical kg x reps, converting and rounding once" | `559d630` fixed the earlier double rounding (weight converted at 6 dp, multiplied, then rounded again; IR-06) |
| HTTP docs and structured Pino logging | Lead implementation | A42–A43, A60, A79–A84 | **verified** | `src/main.ts` Swagger/Scalar; `src/app.module.ts` Pino with `genReqId`/`x-request-id`; filter unit tests; e2e envelope assertions (IR-07 resolved) | OpenAPI schemas were not reviewed field by field against the README |
| Defer trigram index until query-plan evidence | Lead design; Pi review | A10, A32, A39–A40, A62 | **verified** (decision) | 50k evidence: the filtered history page took 0.075 ms on existing indexes, so no `pg_trgm` was added | Revisit only if the catalog grows large |
| External exercise→muscle-group config instead of provider constants | Reviewer A; Pi1 IR-08 | A12, A34, A48 | **verified** | `f611fd3`: `config/exercises.json` (override with `EXERCISE_CATALOG_PATH`) validated at startup by `src/workouts/exercise-catalog.ts`; seeding inserts missing rows only (`orIgnore`). Tests: `exercise-catalog.spec.ts`, `exercise-seed.service.spec.ts`, `environment.spec.ts` | Changing an existing row's muscle group still needs a database update; no admin API by design |
| Shared unit validator tied to the registry, with a stone extension fixture | Reviewer A; Pi1 IR-09 | A33, A48 | **verified** (registry-driven DTOs); **proposed** (stone extension fixture) | `f611fd3`: body, history, PR, and compare DTOs all use `@IsIn(WEIGHT_UNITS)`; `api-contract-validation.spec.ts` "accepts exactly the shared WEIGHT_UNITS registry" (each DTO accepts every registry unit and rejects `stone`) | No fixture adds stone to the registry and checks writes/reads/PRs end to end |
| Explicit migrations, DB constraints, sync-off startup | Reviewer A; Pi1 IR-01 | A37–A39, A59, A61 | **verified** | `src/database/migrations/1770000000000-initial-schema.ts`, with checks, FKs, indexes, and (since `a920c68`) `uuid_generate_v4()` primary-key defaults. `1770000000000-initial-schema.spec.ts`; `test/migrations.e2e-spec.ts` boots the app on a fresh migrated DB with `DB_SYNCHRONIZE=false` (2/2); Compose `migrate` service | History: before `a920c68`, app startup on a freshly migrated DB failed (`null value in column "id" of relation "exercises"`), reproduced locally on 2026-09-26 during the docs pass; the synchronize-based workflow e2e suite could not see it. The fix edits the initial migration in place, so a DB migrated with the earlier revision must be recreated |
| 256 KiB body cap, shared error envelope/request ID, validated config | Reviewer A; Pi1 IR-07 | A43, A46, A54, A59–A61 | **verified** | `main.ts` body parser limits; `http-exception.filter.ts` plus 4 unit tests (incl. 413 envelope); `environment.ts` plus 2 unit tests | — |
| Validate malformed cursor key types/values before SQL | Reviewer B; Pi1 IR-13 | A14, A44, A46 | **verified** | `decodeCursor` checks the version, types, calendar date, microsecond timestamp, and UUID; unit and e2e tests. `559d630`: `isUuid` accepts any canonical PostgreSQL `uuid` text; `api-contract-validation.spec.ts` "accepts any PostgreSQL uuid as a cursor id, including non-RFC md5(...)::uuid keys"; migration e2e pages history across `md5(...)::uuid` keys | Earlier, the RFC v1–5 check would have rejected cursors over non-RFC IDs such as the 50k seed's |
| Validate normalized Unicode exercise-name length before persistence | Reviewer B; Pi1 IR-14 | A03, A21, A46 | **applied** | `hasValidNormalizedExerciseNameLength` in `src/common/exercise-name.ts`, checked in `log()` | No test with a lowercase-expanding name |

## Additional improvements actually applied

| Improvement | Related requirements | Status | Evidence |
|---|---|---|---|
| Reject numeric-string weights (`enableImplicitConversion: false`) | A04, A21, A46 | **verified** | `src/main.ts`; `api-contract-validation.spec.ts` "rejects numeric strings"; e2e numeric-string case |
| PR tie order ends with `ws.id ASC`, matching the documented contract (resolves AI-06 docs drift) | A18, A50 | **verified** | `6259c48`; e2e deterministic-tie PR test |
| Validation errors always return `details` as an array; 5xx returns `details: null` | A43, A54 | **verified** | `6dd112b`; filter unit tests |
| DB pool, statement, lock, and idle-transaction timeouts validated at boot; production rejects the default password | A61 | **verified** | `src/config/environment.ts`; `environment.spec.ts` |
| Liveness/readiness endpoints, graceful `SIGTERM`/`SIGINT` shutdown | A59–A60 | **applied** | `src/health.controller.ts`; `enableShutdownHooks` in `main.ts`. `/health/ready` returned `{"status":"ok","checks":{"database":"up"}}` in the 2026-09-26 docs-example run; shutdown is not tested |
| Compose `migrate` one-shot service gates `app` startup | A59, A81 | **applied** | `docker-compose.yml`. The UUID-default blocker is fixed (`a920c68`), but the Compose path has not been run end to end on this branch |
| Migration-backed e2e (fresh DB, versioned migrations, `DB_SYNCHRONIZE=false`, log/history-cursor/PR flow) | A37–A39, A59 | **verified** | `559d630`: `test/migrations.e2e-spec.ts`, `pnpm test:e2e:migrations` 2/2 |
| Workflow e2e drops and recreates its database each run instead of reusing an existing one | A56–A58 | **verified** | `a5046ed`: `test/workout-workflows.e2e-spec.ts` `beforeAll`; `pnpm test:e2e` 21/21. Before this, `CREATE DATABASE` ran only when the database was missing, so schema or data left by an earlier run or branch could carry into the next run. This is a test-isolation fix, not a recorded AI mistake |
| `explain-50k.sql` uses the service's `LIMIT 21` lookahead and final `ws.id` PR tie key | A32, A62 | **applied** | `559d630`. The recorded 50k timings used the earlier shape and have not been remeasured |
| Reproducible 50k seed/explain harness with evidence committed to the repo | A32, A62 | **verified** (one run) | `scripts/perf/`; [`notes/evidence/`](evidence/README.md) |

## Proposed / open (not implemented)

| Improvement | Why | Status |
|---|---|---|
| Row-value keyset predicate `(workout_date, created_at, id) < ($1,$2,$3)` so deep pages use an index bound | Measured 25,001 rows filtered at depth 25k | proposed; re-measure before claiming |
| Cheaper PR plan (avoid parallel seq scan of all `workout_sets`) only if larger set counts show a need | Measured ~31–34 ms with full `workout_sets` scan | proposed |
| HTTP-level latency/concurrency measurement | Current evidence is query plans only | proposed |
| HMAC-signed cursors, auth/authorization | Out of assignment scope; unsigned scope hash only detects mismatch | deferred (documented trade-off) |
