# Implementation Plan — Historical Snapshot

> **Historical artifact.** This document records how the assignment was decomposed before implementation. It is kept to show planning and iteration, not as the current product contract. For current behavior use the [README](../../README.md), [architecture](../../docs/architecture.md), [API design](../../docs/api-design.md), [database design](../../docs/database-design.md), and code.

## Planning principle

The work was split into reviewable phases so each layer could be implemented and independently checked before the next one depended on it.

```text
contract
   ↓
foundation
   ↓
schema + units
   ↓
logging
   ├────────► history
   └────────► personal records
                 ↓
        operational hardening
                 ↓
        tests + 50k evidence
                 ↓
        docs + AI workflow
                 ↓
        clean-checkout review
```

## Planned phases and what they became

| Phase | Original intent | Resulting work |
| --- | --- | --- |
| P0 | Freeze date, numeric, cursor, PR, and no-data contracts | architecture/API/ADR baseline in `8a542b3` |
| P1 | Bootstrap NestJS + PostgreSQL | `71aec40` |
| P2 | Schema and unit normalization | `bf6b979` plus migration/config hardening |
| P3 | Atomic bulk workout logging | `9abb739` |
| P4 | Filtered history + cursor pagination | `9abb739` plus later cursor corrections/tests |
| P5 | PRs + range comparison | `f40e4c3` plus later numeric/tie corrections |
| P6 | Errors, config, logging, Docker, runtime safeguards | `6c40fd9`, `a58ccb2`, and later hardening commits |
| P7 | Adversarial tests + 50k query evidence | `bcecfe9`, `36159fa`, migration/e2e corrections |
| P8 | README + AI workflow + video preparation | `bdd66df` and later documentation reconciliation |
| P9 | Clean-checkout submission verification | final verification/fix commits on `main` |

The exact commit grouping changed as tests exposed real problems. That divergence is intentional evidence of iterative development; `git log` is the authoritative timeline.

## Decisions frozen before implementation

- calendar `workout_date DATE`; UTC timestamps only for system/ingestion time;
- public JSON-number weights with decimal-safe internal conversion;
- original weight/unit + canonical kg persisted per set;
- shared exercise identity using trim + lowercase normalization;
- exact-name PR lookup versus literal partial-name history filtering;
- atomic multi-exercise POST; same-day repeats allowed;
- keyset history cursor `(workout_date, created_at, id)`;
- valid no-data requests return `200` with empty/null data and a short message;
- no auth, Redis, queues, microservices, trigram index, or idempotency keys without requirement/evidence.

## Verification strategy

The plan intentionally separated four kinds of proof:

1. **Contract tests** for validation, normalization, cursor encoding, and arithmetic.
2. **DB-backed E2E** for real transactions, filters, no-data behavior, concurrency, and PRs.
3. **Migration-backed E2E** with `DB_SYNCHRONIZE=false` to catch drift that synchronized test schemas can hide.
4. **Measured query plans** on a 50k-entry dataset before proposing new indexes/infrastructure.

This separation later caught real defects in migration UUID defaults, E2E isolation, and generated-test expectations.

## Historical requirement matrix

The original detailed A01–A102 planning matrix remains in [`requirement-traceability.md`](requirement-traceability.md). It deliberately preserves pre-implementation wording and should not be read as current status.
