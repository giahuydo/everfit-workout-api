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

A real PostgreSQL run produced **12 failures**. The failures were reviewed rather than blindly "fixed to green": stale assertions were separated from real product/harness issues, then corrected in `6259c48` and `6dd112b`. That cycle later reached 19/19 for the workflow suite and was followed by additional migration-backed coverage.

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

## Verification boundary

A green test suite is evidence only for the environment and layer it actually exercised. This mattered three times:

1. **Synchronized schema vs. migrations.** Workflow E2E used `DB_SYNCHRONIZE=true`, so it could not catch missing UUID defaults in the versioned migration. `a920c68` fixed the migration; `559d630` added migration-backed E2E with `DB_SYNCHRONIZE=false`.
2. **Test database isolation.** The workflow suite originally reused an existing DB. `a5046ed` changed it to drop/recreate the disposable DB each run.
3. **Docker reproducibility.** A clean image build selected a newer pnpm whose release-age policy rejected fresh lockfile packages. `2557505` pinned pnpm 10.28.2 for host/Docker reproducibility.

These are process findings, not fabricated AI-error stories; no retained record proves which tool/person introduced them.

## Current verification

Current uncommitted workspace: `pnpm build` and `pnpm lint` passed; `pnpm test` passed **39/39 in 8 files**. The later module-local spec and OpenAPI refactors have not had a fresh DB-backed E2E/Compose run.

Earlier verification recorded on 2026-09-26:

- `pnpm test:e2e` — 23/23 in 2 DB-backed files;
- `pnpm test:e2e:migrations` — 2/2;
- clean Docker/Compose startup — migration completed before app startup; live/ready healthy; POST workout smoke returned 201.

See [`docs/verification.md`](docs/verification.md) for the current/local versus historical DB verification boundary. The 50k timings come from one earlier local query-plan run and are intentionally described with limitations in [`notes/experiments.md`](notes/experiments.md).

## Supporting evidence

The internal [`notes/ai-findings.md`](notes/ai-findings.md) ledger keeps provenance and reconciliation detail behind the concise cases above. It is supporting evidence, not a second public workflow narrative.
