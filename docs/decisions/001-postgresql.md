# ADR 001 — PostgreSQL

Status: proposed for implementation.

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
