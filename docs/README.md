# Documentation Guide

**Audience:** reviewers and engineers who want more detail than the root README.

The docs are intentionally layered. Start with the shape of the service, then drill into HTTP behavior, persistence, and the individual decisions behind the design. Historical planning and forensic evidence live under `notes/`, not beside the current system docs.

## Start here

```text
README.md
   │
   ▼
docs/architecture.md       — how the system is shaped and how requests flow
   │
   ├──► docs/api-design.md      — public HTTP contract
   ├──► docs/database-design.md — persistence, transactions, indexes, query shapes
   ├──► docs/verification.md    — test, runtime, and performance evidence
   │
   └──► docs/decisions/         — focused design rationale
```

## Current system docs

| Document | Read it for |
| --- | --- |
| [Architecture](architecture.md) | system shape, module boundaries, business/write/read flows, operational boundaries, scaling stance |
| [API design](api-design.md) | endpoint purpose, request/response contracts, filters, pagination, no-data behavior, errors |
| [Database design](database-design.md) | schema, table responsibilities, atomic writes, concurrency, indexes, PR query shape |
| [Verification](verification.md) | build/test gates, runtime safeguards, migration evidence, 50k query-plan evidence and limits |
| [Architecture decisions](decisions/) | why PostgreSQL, canonical kg, date-only workouts, and keyset pagination were chosen |

## Supporting material

- [`AI_WORKFLOW.md`](../AI_WORKFLOW.md) — how AI was directed, reviewed, corrected, and verified.
- [`notes/experiments.md`](../notes/experiments.md) — measured 50k query-plan evidence and its limits.
- [`notes/evidence/`](../notes/evidence/) — raw recorded performance output.
- [`notes/history/`](../notes/history/) — historical planning artifacts; useful provenance, not current contract.
- [`notes/ai-findings.md`](../notes/ai-findings.md) and [`notes/improvements-log.md`](../notes/improvements-log.md) — internal forensic/reconciliation ledgers.

## Source-of-truth rule

The running code and versioned migration are authoritative for implemented behavior. The root README is the reviewer-facing summary; these docs explain the design in more depth; `notes/` preserves evidence and history.
