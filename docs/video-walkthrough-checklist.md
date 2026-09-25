# Video walkthrough checklist (15–20 minutes, English)

**Status: not recorded.** No video exists yet, and none should be claimed until a finished, accessible recording link is added here. This checklist covers assignment items A88–A94.

## Before recording

- [ ] The branch being demoed includes UUID primary-key defaults in `InitialSchema1770000000000` (`a920c68`). A database migrated with the earlier revision of that migration fails at startup; recreate it with `docker compose down -v` (see [README](../README.md#run-locally)).
- [ ] Re-run `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` on the demoed commit; quote only counts from that run.
- [ ] Fresh start: `docker compose down -v && DB_PASSWORD=demo docker compose up --build`, then `curl localhost:3000/health/ready` returns `database: up`.
- [ ] Prepare the demo requests (curl or Scalar at `/reference`). Use one user such as `coach-demo` and two dates in different months.
- [ ] Open these files in tabs: `README.md`, `AI_WORKFLOW.md`, `docs/decisions/00*.md`, `notes/evidence/2026-09-25-local-50k-explain.out`, and the chosen AI-generated code (see segment 5).
- [ ] Do a timed rehearsal: total between 15:00 and 20:00, spoken in English.

## Segments and target times

| # | Segment | Time | Must show / say |
|---|---|---|---|
| 1 | Architecture and why | ~3:00 | Single NestJS service plus PostgreSQL; the three tables; why PostgreSQL (ADR 001); date-only `workout_date` vs UTC `created_at` (ADR 003); original plus canonical kg with decimal math (ADR 002); keyset cursor (ADR 004); migrations, not `synchronize` |
| 2 | API demo, happy paths | ~4:00 | `POST /v1/users/:userId/workouts` with two exercises and mixed kg/lb → `201`; history with `exerciseName` substring, `from`/`to`, `muscleGroup`, `unit=lb`, `limit=1` then follow `nextCursor`; `GET personal-records` showing three independent winners and `achievedDate`; `GET personal-records/compare` across two months |
| 3 | Errors and edge cases | ~3:00 | `unit: "stone"` → `400 VALIDATION_ERROR` with `details`; bulk request with one bad exercise commits nothing (history is unchanged afterwards); null date / negative reps / empty `sets`; numeric-string weight rejected; malformed or query-mismatched cursor → `400` (the scope hash detects mismatch, not tampering); no-data history and PR → `200` with a `message`; mention the `413` body cap |
| 4 | AI workflow | ~3:00 | Walk through the [AI_WORKFLOW.md](../AI_WORKFLOW.md) tool table; rejected suggestions (`performedAt` midnight UTC, decimal-string weights, ID/404 PR lookup); the suboptimal cursor tuple; the generated e2e suite with 12 failures → classified → 19/19 (AI-07); how contracts were put first |
| 5 | One AI-generated piece, line by line | ~3:00 | Recommended: the history keyset/cursor code in `src/workouts/workouts.service.ts` (`history`, `decodeCursor`, `isUtcMicrosecondTimestamp`). Before choosing it, confirm its provenance in `git log -p`/the executor session and state which lines were AI-written and which were corrected. Explain each line: filters, the expanded `OR` predicate, the `to_char(... 'US')` microsecond key, `limit + 1`, scope hash, and the validation order |
| 6 | Scaling to 10k concurrent coaches | ~2:30 | Separate what was measured from what is proposed. **Measured:** one local 50k query-plan run only; deep-page filter scanned 25,001 rows; PR queries do a parallel seq scan of `workout_sets`. **Proposed:** stateless API replicas behind a load balancer, pool sizing / PgBouncer, a row-value keyset predicate, PR projections or materialized per-exercise maxima, read replicas for history, and HTTP load testing before any capacity claim. Do not quote a throughput number |
| 7 | Trade-offs and wrap-up | ~1:00 | No auth (`userId` is a parameter), unsigned cursor scope hash, catalog metadata edits affect old entries, no snapshot pagination |

## After recording

- [ ] Length is between 15:00 and 20:00; audio is clear; the language is English throughout.
- [ ] Every figure spoken matches README/`notes/experiments.md`. No figure is presented as endpoint latency or capacity.
- [ ] Upload with link access, test the link in a private window, and add it here and to the README.
