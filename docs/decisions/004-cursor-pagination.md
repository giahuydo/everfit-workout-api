# ADR 004 — Cursor Pagination

**Status:** Accepted and implemented.

## Context

Workout history must paginate and remain useful with 50k+ entries per user. Deep offset pagination can repeatedly scan/skips rows and becomes unstable as new rows are inserted.

## Decision

Use keyset pagination ordered by:

```text
workout_date DESC → created_at DESC → id DESC
```

The opaque versioned cursor stores all three last-row keys and binds them to `userId`, effective filters, requested unit, and page size. `created_at` is serialized with all six PostgreSQL microsecond digits.

Malformed cursors or cursors reused with different effective query parameters return `400`.

## Why

- `workout_date` matches the user-facing chronology;
- `created_at` provides practical same-day ingestion order;
- `id` closes the deterministic ordering;
- keyset continuation avoids semantic dependence on a numeric offset.

The scope hash detects accidental query mismatch. It is not authentication, authorization, secrecy, or tamper-proof signing.

## Consequences

- supporting index begins with `user_id` plus the three ordering keys;
- continuation is lexicographically older than the final row under the same filters;
- fetch `limit + 1` **entries**, then load sets, so a page never splits an entry;
- pagination is not a database snapshot across requests;
- concurrent inserts and catalog metadata edits may change what later pages contain;
- HMAC signing is deferred unless cursor integrity becomes a product/security requirement.

## Measured limitation

The recorded 50k run showed the current expanded keyset predicate acting as an index `Filter` at deep pages, removing 25,001 rows rather than becoming an index bound. The next evidence-driven optimization would be a row-value comparison, followed by re-measurement—not extra infrastructure by default.

See [`notes/experiments.md`](../../notes/experiments.md).
