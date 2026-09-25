# ADR 001 — PostgreSQL

Status: accepted and implemented. PostgreSQL with TypeORM and versioned migrations (`src/database/migrations/`, `synchronize: false` in `src/database/data-source.ts`); migration from an empty database and 50k query plans were verified locally (see [experiments](../../notes/experiments.md)). The initial migration creates `uuid_generate_v4()` primary-key defaults (`a920c68`), which runtime catalog seeding needs; this is covered by `src/database/migrations/1770000000000-initial-schema.spec.ts` and by `test/migrations.e2e-spec.ts`, which boots the app on a freshly migrated database with `DB_SYNCHRONIZE=false`.

## Context

The assignment allows PostgreSQL or MongoDB and asks for justification, schema design, indexes, query efficiency, normalization, history filters, PR aggregation, and concurrent writes.

## Decision

Use PostgreSQL with TypeORM entities and explicit versioned migrations. Do not enable production schema synchronization.

## Rationale

The domain has clear relationships between exercises, workout entries, and sets. SQL is a natural fit for transactional bulk writes, foreign-key integrity, date/user filtering, keyset pagination, and PR aggregate/ranking queries. PostgreSQL also gives deterministic numeric arithmetic and query-plan tooling for the 50k+ entries/user requirement.

## Consequences

- Local/test environments require PostgreSQL, normally through Docker Compose.
- Query-heavy paths may use QueryBuilder or carefully reviewed SQL rather than forcing every aggregation through simple repository helpers.
- Index changes must be justified by actual query shapes and representative `EXPLAIN` evidence.
- MongoDB remains viable in another design, but its document model provides no compelling advantage for this assignment's relational/aggregation needs.
