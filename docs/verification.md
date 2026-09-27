# Verification and Operational Evidence

This document keeps implementation evidence out of the root README while preserving the exact verification and performance boundaries used for the take-home.

## Automated verification

Current uncommitted workspace (2026-09-26): `pnpm build` and `pnpm lint` passed; `pnpm test` passed **39/39 tests in 8 files**. Source unit specs live under feature-local `src/**/spec/` directories; DB-backed E2E specs remain in `test/`. The three PR service cases cover distinct per-metric winner mapping, independent comparison ranges, and rejecting invalid inputs before queries. Mocked winners do not prove PostgreSQL's SQL winner selection.

Earlier recorded run on 2026-09-26 (before the module-local spec/DTO refactors): `pnpm test:e2e` passed **23/23 in 2 PostgreSQL-backed files** and `pnpm test:e2e:migrations` passed **2/2**. These DB-backed results are **historical**, not a claim that E2E was rerun after the current uncommitted changes.

A clean Compose build also passed after pinning pnpm 10.28.2. The one-shot migration service exited successfully, `/health/live` and `/health/ready` returned `200`, and a workout POST smoke request returned `201`.

## Runtime safeguards

The service caps request bodies at 256 KiB, validates configuration before database connection, emits request IDs, returns a structured error envelope, avoids exposing stack traces, handles `SIGTERM`/`SIGINT`, and exposes liveness/readiness endpoints.

Schema changes are versioned migrations. Production rejects `DB_SYNCHRONIZE=true`; database readiness is checked separately from process liveness.

## Migration evidence

The migration creates the exercise catalog, workout entries, ordered sets, UUID primary-key defaults, foreign keys, numeric precision, and history indexes.

Migration-backed E2E starts from a fresh database with `DB_SYNCHRONIZE=false`, runs versioned migrations, boots the application, and verifies that no migrations remain pending.

## 50k query-plan evidence

The deterministic harness seeds one user with 50,000 workout entries and 174,823 sets across seven exercises, covering dates from 2022-09-27 through 2026-09-25.

`EXPLAIN (ANALYZE, BUFFERS)` execution times, 2026-09-27, fresh PostgreSQL 16 container, seeded once and `explain-50k.sql` run five times (range across runs):

| Query shape | Before (expanded `OR` keyset) | After (row-value keyset) |
| --- | ---: | ---: |
| History, unfiltered first page | 0.10–0.15 ms | 0.09–0.58 ms |
| History, partial name + date + muscle group | 0.04–0.06 ms | 0.05–0.09 ms |
| History, deep keyset page after row 25,001 | 5.8–9.2 ms, ~25,356 buffers | 0.10–0.60 ms, 27 buffers |
| PR heaviest / highest volume / estimated 1RM | 27–32 / 29–31 / 31–39 ms | 25–41 / 29–40 / 32–50 ms (one run hit 125 ms on heaviest) |

Only the deep-page predicate changed between the two columns; other differences are run-to-run noise on a laptop. These are SQL execution-plan timings, not HTTP latency, throughput, percentiles, or evidence that the service supports 10,000 concurrent coaches.

## What the plans show

- The first history page and the representative filtered history query are cheap at the measured dataset size.
- The deep keyset page now uses the row-value predicate as an `Index Cond` on `idx_workout_entries_user_cursor`, so it no longer filters earlier rows. The earlier expanded `OR` predicate was applied as a `Filter` (`Rows Removed by Filter: 25001`). The row-value form is valid because all three sort keys are `DESC`; before switching, both predicates were compared on 540 cursors (including 40 rows sharing one `workout_date` and `created_at`) with zero page differences.
- PR queries select the user's entries efficiently but still scan a significant number of `workout_sets` (`Parallel Seq Scan`), so PR cost grows with accumulated set count.
- The evidence SQL is a hand-written equivalent of the application query shape, not captured ORM SQL.

## Reproduce the 50k harness

Against a migrated local PostgreSQL database:

```sh
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:<port>/<database> \
  scripts/perf/run-50k-evidence.sh
```

For a rehearsal or video run without modifying committed evidence:

```sh
PERF_OUTPUT_DIR=/tmp/everfit-perf-video \
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:<port>/<database> \
  scripts/perf/run-50k-evidence.sh
```

Raw recorded output lives in [`../notes/evidence/`](../notes/evidence/README.md), with analysis in [`../notes/experiments.md`](../notes/experiments.md).

## Related docs

- [Architecture](architecture.md)
- [API design](api-design.md)
- [Database design](database-design.md)
- [AI workflow](../AI_WORKFLOW.md)
