# AI Workflow

AI was used as a design and review assistant. The engineer supplied the fixed API/date/numeric contracts, required bounded suggestions, and verified the resulting implementation with source review plus build, lint, tests, migrations, and query-plan tooling where the environment allowed. AI output was never accepted as authority over the assignment.

## Tools and purposes

This mapping comes from the repository history plus local session metadata: Claude Code project logs, Pi session JSONL files, and Cursor chat metadata. Those local logs are not part of the repository. Model names are the ones recorded in that metadata. The mapping shows who did what, not how any model reasoned.

| Tool (recorded model) | Role | Architecture | Coding | Testing | Debugging | Docs |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT (engineer-reported; no transcript in repo) | Orchestrator | Split work into phases and parallel executor tasks with fixed contracts | Wrote bounded executor prompts (A–F, final passes) | With the engineer, classified generated-test failures as product defects or stale assertions (AI-07) | With the engineer, turned the 12 DB e2e failures into the fixes in `d50f2a7`, `6259c48`, `6dd112b` | Set the docs/evidence reconciliation scope |
| Pi agent (`gpt-6-sol`, per Pi session metadata) | Lead writer (Pi1) and reviewers (Pi2 requirements, Pi3 DB/SQL, Pi4 tests/delivery, plus continuity reviewer and Reviewer B) | P0 contract review: date/timezone, numeric, cursor, PR ties; source of AI-01–AI-04 and AI-06 | Code review findings IR-01–IR-14 against the first feature commits | Planned test gates in the traceability matrix | Challenged Pi1's IR-11 severity (AI-06) | Plan/traceability condensation (now historical snapshots) |
| Claude Code (`claude-opus-5-5`, per Claude Code session logs) | Executor in isolated git worktrees | Materialized the planning docs from the agreed design | Executors A (contract/validation, `6c40fd9`), B (migrations/concurrency, `1b06460`), D (runtime/Docker, `a58ccb2`); final hardening (`f611fd3`, JSON catalog and shared unit registry) and correctness (`559d630`, volume rounding, PostgreSQL UUID cursors, migration-backed e2e) passes, first on separate branches and now integrated | Executor C wrote the DB-backed e2e suite (`bcecfe9`) whose stale assertions are case AI-07; executor E wrote the 50k harness (`36159fa`) | A docs pass ran the app on a migrated DB and reproduced the missing-UUID-default startup failure (fixed on this branch by `a920c68`) | Executor F (`bdd66df`) and this reconciliation pass |
| Cursor agent (Claude Sonnet 5, per Cursor chat metadata) | Local chats in the integration worktree on 2026-09-26 | — | — | — | — | No Cursor finding is cited here; the planned `cursor-*-review` board files are empty |

The first feature commits (`71aec40`–`f40e4c3`) were made before the retained executor sessions, and this document does not attribute them to a specific tool.

## Evidenced corrections

The following cases are supported by the retained AI findings evidence; they are concise paraphrases of visible assistant suggestions, not reconstructed hidden reasoning.

| Case | AI output or suggestion | Human correction and outcome |
| --- | --- | --- |
| Workout time | Add optional `performedAt`, synthesize midnight UTC when missing, and derive the workout day. | Rejected. The contract is a client calendar `YYYY-MM-DD` stored as `DATE`; creating midnight UTC would fabricate workout time. `created_at` remains ingestion UTC. |
| Numeric transport | Require decimal-string weights in the public JSON API. | Rejected. The public contract requires JSON-number `weight`; decimal-safe conversion is internal and the database uses `NUMERIC`. |
| PR lookup/no-data | Make PR lookup exercise-ID based and return `404` for an unknown exercise. | Rejected. The endpoint is exact normalized exercise-name lookup; a valid no-data request returns `200` with null records and a message. |
| Cursor ordering | Page same-day history by `(workout_date, id)` only. | Corrected as suboptimal. The implementation uses `(workout_date, created_at, id)` and preserves six-digit microseconds in the cursor so ingestion ordering is deterministic without treating it as workout time. |
| Generated E2E suite | Generated test coverage in `bcecfe9` expected `pageInfo.nextCursor`, a removed `deltaAminusB`, and a wrong `achievedDate`; it also enabled implicit conversion and omitted the production global `HttpExceptionFilter`. | A real database-backed run found 12 failures. Human/orchestrator classified them as product defects or stale assertions, aligned the harness and contracts in `6259c48`, standardized validation-error details in `6dd112b`, and obtained 19/19 green. This is a strong wrong/suboptimal AI coding/testing example, not a claim about hidden reasoning. |

The first three are rejected suggestions; the last is a reviewed design correction. The first two also satisfy the required examples of suboptimal/wrong output followed by a human correction.

The verification loop for generated tests was: generated tests → actual database run → failures classified as product defect versus stale assertion → corrections → 19/19 green. The test suite was evidence to review, not evidence to accept unexamined.

## Working practices

- Put non-negotiable contracts first: calendar dates versus timestamps, public JSON numbers versus internal decimal arithmetic, exact PR lookup versus history substring filtering, and valid no-data behavior.
- Ask for narrowly scoped changes with named files and acceptance checks; prefer migrations over synchronized schemas and avoid new infrastructure without measured evidence.
- Independently review generated code against the API contract, especially cursor precision, response shapes, decimal conversion, and SQL ordering.
- Keep evidence claims separate from plans: do not claim test results, benchmarks, or AI provenance that was not actually recorded.

## Verification boundary

This workflow describes real review decisions, not a claim that every command or performance harness has succeeded on every machine. The README reports the current runnable commands and their environmental requirements. No private prompt chain or hidden reasoning is reproduced here.

On this branch, on 2026-09-26: `pnpm build` passed, `pnpm lint` reported 0 warnings and 0 errors, `pnpm test` passed 34/34 in 7 files, `pnpm test:e2e` passed 21/21 in 2 files, and `pnpm test:e2e:migrations` passed 2/2. A clean Docker/Compose build and startup also passed after pinning pnpm 10.28.2; migrations completed before app startup, liveness/readiness were healthy, and a POST workout smoke request returned 201. The 50k numbers are from one earlier query-plan run, described with their limits in [experiments](notes/experiments.md).

Two verification gaps were found after the 19/19 run. Neither is attributed to a specific AI output, because no retained session record shows its origin:

- **Synchronized schema versus migrations.** The workflow e2e suite builds its schema with `DB_SYNCHRONIZE=true`, so it passed while app startup on a freshly migrated database failed for lack of UUID defaults. Fixed by `a920c68`; `559d630` added `test/migrations.e2e-spec.ts`, which boots the app on versioned migrations with `DB_SYNCHRONIZE=false`.
- **Test database isolation.** The workflow suite created its database only if it was missing, so schema or data left by an earlier run or branch could carry over. `a5046ed` drops and recreates it on every run.
- **Docker package-manager reproducibility.** The first clean image build let Corepack select pnpm 12.6.0, whose minimum-release-age policy rejected several lockfile packages published within the cutoff. The application code was not the failure. `2557505` pins pnpm 10.28.2 in `package.json` and the Docker build; the subsequent no-cache image build and Compose startup passed. This is recorded as a verification/process finding, not an AI hallucination.

The lesson is the same as for AI-07: a green suite is evidence only for the environment it actually ran against.
