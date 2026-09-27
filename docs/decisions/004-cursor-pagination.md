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

## Measured change

The first 50k run showed the expanded keyset predicate (`date < d OR (date = d AND created_at < c) OR ...`) acting as an index `Filter` at deep pages, removing 25,001 rows rather than becoming an index bound. The predicate is now the row-value comparison `(workout_date, created_at, id) < (d, c, id)`, which PostgreSQL uses as an `Index Cond`: the page after row 25,001 dropped from ~6–9 ms and ~25k buffers to ~0.1 ms and 27 buffers. This relies on every sort key sharing the same `DESC` direction; a mixed-direction sort would need the expanded form again. No index or infrastructure was added.

See [`notes/experiments.md`](../../notes/experiments.md).
