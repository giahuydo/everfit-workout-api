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

The recorded (earlier) deterministic harness run used one user with 50,000 workout entries and 174,823 sets across seven exercises, covering dates from 2022-09-27 through 2026-09-25.

Recorded `EXPLAIN (ANALYZE, BUFFERS)` execution times from the local evidence run:

| Query shape | Time |
| --- | ---: |
| History, unfiltered first page | 0.179 ms |
| History, partial name + date + muscle group | 0.075 ms |
| History, deep keyset page after row 25,001 | 7.359 ms |
| PR heaviest / highest volume / estimated 1RM | 30.783 / 31.498 / 34.247 ms |

These are SQL execution-plan timings from one local warm-ish run. They are not HTTP latency, throughput, a repeated benchmark, or evidence that the service supports 10,000 concurrent coaches.

## What the plans show

- The first history page and the representative filtered history query are cheap at the measured dataset size.
- The deep keyset predicate still filtered 25,001 earlier rows and touched 25,386 buffers in the recorded run, so deep-page cost still grows with page depth.
- PR queries select the user's entries efficiently but still scan a significant number of `workout_sets`, so PR cost grows with accumulated set count.
- The evidence SQL is a hand-written equivalent of the application query shape, not captured ORM SQL.

The recorded evidence used an earlier script shape with `LIMIT 51` history lookahead and PR ties ending at `set_order`. The current harness uses the service's `LIMIT 21` lookahead and final `ws.id` tie key; rerun the harness before quoting fresh performance numbers.

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
