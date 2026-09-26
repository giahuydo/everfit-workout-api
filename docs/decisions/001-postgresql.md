# ADR 001 — PostgreSQL

**Status:** Accepted and implemented.

## Context

The assignment allows PostgreSQL or MongoDB and explicitly evaluates schema design, indexing, query efficiency, normalization, aggregations, and concurrent writes.

## Decision

Use PostgreSQL with TypeORM entities and explicit versioned migrations. Production schema synchronization stays disabled.

## Why

The domain is naturally relational: exercises are shared identities, workout entries belong to users/dates/exercises, and sets belong to entries. PostgreSQL gives this design:

- atomic multi-exercise writes;
- foreign-key and check-constraint integrity;
- `DATE` plus microsecond UTC timestamps;
- exact `NUMERIC` arithmetic for normalized weights and PRs;
- SQL filtering/ranking for history and personal records;
- composite indexes and `EXPLAIN (ANALYZE, BUFFERS)` for the 50k target.

MongoDB could also implement the assignment, but its document model adds no clear advantage for these relational and aggregation-heavy access patterns.

## Consequences

- Local/test runs need PostgreSQL, normally via Docker Compose.
- Migrations are the schema source of truth; a database migrated with an obsolete edited initial migration should be recreated.
- Query-heavy paths may use QueryBuilder/reviewed SQL instead of simple repository helpers.
- Index changes should follow measured query plans rather than speculation.

## Evidence

The migration creates UUID defaults, constraints, and indexes. Migration-backed E2E boots the app with `DB_SYNCHRONIZE=false`, and the 50k query-plan run is recorded in [`notes/experiments.md`](../../notes/experiments.md).
