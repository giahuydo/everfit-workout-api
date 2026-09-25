# AI Workflow

AI was used as a design and review assistant. The engineer supplied the fixed API/date/numeric contracts, required bounded suggestions, and verified the resulting implementation with source review plus build, lint, tests, migrations, and query-plan tooling where the environment allowed. AI output was never accepted as authority over the assignment.

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
