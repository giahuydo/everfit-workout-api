# Architecture Decision Records

**Audience:** reviewers who want the reasoning behind the implementation, not another copy of the API contract.

Each ADR captures one decision that materially shapes the service. Current code/migrations are authoritative for implementation details; ADRs preserve **context → decision → why → consequences → evidence**.

| ADR | Decision | Why it matters |
| --- | --- | --- |
| [001](001-postgresql.md) | PostgreSQL + versioned migrations | transactions, integrity, aggregations, and query-plan evidence |
| [002](002-canonical-weight-normalization.md) | preserve original measurement + canonical kg | mixed-unit history and PRs remain comparable |
| [003](003-workout-date-and-timezone.md) | calendar workout date + UTC ingestion timestamp | avoids inventing time/timezone data |
| [004](004-cursor-pagination.md) | keyset cursor `(workout_date, created_at, id)` | deterministic history pagination without deep numeric offsets |

Start with the [architecture overview](../architecture.md). For exact endpoint behavior see [API design](../api-design.md); for schema/index details see [database design](../database-design.md).
