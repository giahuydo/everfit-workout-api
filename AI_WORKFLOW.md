# AI Workflow

The project used AI as an implementation and review accelerator, not as an authority. The engineer fixed the public contracts first, delegated bounded tasks, reviewed generated output against those contracts, and verified behavior with real builds, tests, migrations, and query-plan evidence.

## Workflow at a glance

```text
assignment + fixed contracts
          │
          ▼
   decompose small tasks
          │
          ├─ ChatGPT: orchestration / review framing
          ├─ Pi: contract and adversarial review
          ├─ Claude Code: isolated implementation passes
          └─ Cursor: local review support
          │
          ▼
     inspect generated diff
          │
          ▼
 run build / lint / DB tests / migrations / EXPLAIN
          │
          ├─ wrong or stale? → correct and rerun
          └─ verified?       → integrate
```

The retained evidence supports tool roles and concrete corrections; it does not expose or reconstruct private chain-of-thought.

## Tool roles

| Tool | Main role | Examples of use |
| --- | --- | --- |
| ChatGPT | orchestration and review framing | phase decomposition, bounded executor prompts, classification of failed generated tests, documentation/evidence reconciliation |
| Pi agents | independent reviewers | date/numeric/cursor/PR contracts, DB/SQL review, test/delivery review, challenge of prior reviewer claims |
| Claude Code | isolated executor | contract/validation, migrations/concurrency, runtime/Docker, E2E generation, 50k harness, final hardening passes |
| Cursor | local review support | adversarial review of the integrated worktree; no unverified Cursor finding is used as final evidence here |

The first feature commits (`71aec40`–`f40e4c3`) predate the retained executor sessions, so this document does not invent tool provenance for them.

## Examples where AI output was wrong or suboptimal

### 1. Fabricated workout time

**Suggestion:** add optional `performedAt`, synthesize midnight UTC when missing, and derive the workout date from it.
**Why it was wrong for this contract:** the assignment supplies a calendar `date`, not a real workout timestamp. Midnight UTC would create false precision and timezone semantics.
**Correction:** keep `workout_date DATE`; use UTC `created_at` only as ingestion/audit time. See [ADR 003](docs/decisions/003-workout-date-and-timezone.md).

### 2. Decimal strings in the public API

**Suggestion:** require decimal-string weights for precision.
**Why it was wrong for this contract:** the public API is JSON-number based; precision can be preserved internally without changing the transport type.
**Correction:** accept JSON numbers, validate the normalized decimal value, convert through decimal-safe arithmetic, and store PostgreSQL `NUMERIC`. See [ADR 002](docs/decisions/002-canonical-weight-normalization.md).

### 3. Generated E2E expectations drifted from the product contract

The generated E2E commit `bcecfe9` expected `pageInfo.nextCursor`, a removed `deltaAminusB`, and an incorrect `achievedDate`; its test bootstrap also differed from production validation/filter wiring.

A real PostgreSQL run produced **12 failures**. The failures were reviewed rather than blindly "fixed to green": stale assertions were separated from real product/harness issues, then corrected in `6ca7daa` and `3840666`. That cycle later reached 19/19 for the workflow suite and was followed by additional migration-backed coverage.

```text
generated tests
     ↓
real DB run → 12 failures
     ↓
classify: stale assertion vs product/harness defect
     ↓
correct tests/contracts/runtime details
     ↓
rerun and verify
```

### 4. A mocked unit test hid a runtime bug

The error-envelope unit test for `413` built its request with a ready-made `id`, so it passed. A real oversized request showed `requestId: "unknown"`: the JSON body parser rejects the body before pino-http assigns the id. The fix moved id resolution into a shared `resolveRequestId()` used by both pino-http and the exception filter (`d0435bc`); new specs cover a request without an id and a client-supplied `x-request-id`. Found by a runtime `curl` check, not by the test suite. See AI-09 in [`notes/ai-findings.md`](notes/ai-findings.md).

## Example of a rejected AI suggestion

**Suggestion:** use exercise-ID PR lookup and return `404` for an unknown exercise.
**Rejected because:** the assignment asks for PRs for a user + exercise name, and valid no-data ranges should return an empty/null result with a message rather than an error.
**Final contract:** exact normalized `exerciseName`; valid no-data returns `200` with null metrics.

## Prompting strategy

The effective pattern was to provide constraints before asking for implementation:

- state the immutable assignment and API/date/numeric contracts first;
- distinguish public JSON numbers from internal decimal arithmetic;
- distinguish calendar workout dates from ingestion timestamps;
- name the files or subsystem in scope and ask for the smallest change;
- ask independent reviewers to challenge earlier conclusions rather than inherit them;
- require evidence (source path, test, migration, or query plan) before accepting severity or completion claims;
- avoid speculative infrastructure until the measured query shape justifies it.

**Rules files and shared context.** The repository has no tool-specific rules file (`CLAUDE.md`, `.cursorrules`). Instead, a local orchestration board (`notes/agent-board/`, not committed) acted as the shared system context: it named the source of truth (assignment + `docs/`), gave each agent one role, kept reviewers read-only with a single integration writer, and stated what counted as an accepted finding.

## Verification boundary

A green test suite is evidence only for the environment and layer it actually exercised. This mattered three times:

1. **Synchronized schema vs. migrations.** Workflow E2E used `DB_SYNCHRONIZE=true`, so it could not catch missing UUID defaults in the versioned migration. `068c29b` fixed the migration; `a8c3d46` added migration-backed E2E with `DB_SYNCHRONIZE=false`.
2. **Test database isolation.** The workflow suite originally reused an existing DB. `c676664` changed it to drop/recreate the disposable DB each run.
3. **Docker reproducibility.** A clean image build selected a newer pnpm whose release-age policy rejected fresh lockfile packages. `92d2bf2` pinned pnpm 10.28.2 for host/Docker reproducibility.

These are process findings, not fabricated AI-error stories; no retained record proves which tool/person introduced them.

## Current verification

On 2026-09-27, at the current HEAD:

- `pnpm build` and `pnpm lint` — pass;
- `pnpm test` — 75/75 in 11 files (unit and contract specs);
- `pnpm test:e2e` — 33/33 in 2 DB-backed files, including the migration-backed suite;
- fresh-clone `docker compose up --build` — migration completed before app startup, `/health/ready` healthy, all four endpoints plus 400/413 checked by hand (413 now returns a real `requestId`);
- 50k query-plan harness rerun after the row-value keyset change (see [`docs/verification.md`](docs/verification.md)).

## Commit history

The initial scaffold (`8a542b3`–`f40e4c3`) was written in one working session and split into reviewable commits afterwards, which is why those commits are minutes apart. Later commits follow the actual review → fix → verify cycles. Before publishing, small consecutive documentation commits were squashed and vague messages reworded; no code change was reordered across a dependency, every rewritten commit reproduces an original tree, and commit references in these docs point to the published hashes.

## Supporting evidence

The internal [`notes/ai-findings.md`](notes/ai-findings.md) ledger keeps provenance and reconciliation detail behind the concise cases above. It is supporting evidence, not a second public workflow narrative.
