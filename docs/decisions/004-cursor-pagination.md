# ADR 004 — Cursor Pagination

Status: accepted and implemented. Keyset `(workout_date DESC, created_at DESC, id DESC)` with six-digit UTC microsecond cursor keys and a scope hash (`src/workouts/workouts.service.ts`); cursor ids accept any canonical PostgreSQL `uuid` text, not only RFC 4122 v1–5 (`559d630`). Covered by cursor-shape, malformed-cursor, scope-mismatch, and non-RFC-UUID tests, plus migration-backed paging across `md5(...)::uuid` keys. Deep-page cost limitation measured in [experiments](../../notes/experiments.md).

## Context

Workout history must support pagination and remain useful with 50k+ entries per user. Offset pagination is simple but can become expensive and unstable at deep offsets while new rows are inserted.

## Decision

Use keyset pagination ordered by `(workout_date DESC, created_at DESC, id DESC)`. Encode all three immutable keys into a versioned opaque cursor bound to `userId`, effective filters, output unit, and page size. Preserve `created_at` as UTC ISO text with six fractional digits from `TIMESTAMPTZ(6)`; never round-trip through a millisecond-precision JS Date. Reject malformed or mismatched cursors with 400.

## Rationale

Keyset pagination can continue from the last row without scanning/skipping a deep offset. `workout_date` is the primary user-facing order, `created_at` gives a practical same-day ingestion order, and `id` provides a deterministic final tie-break.

## Consequences

- The supporting entry index begins with `user_id` followed by the three ordering keys.
- Date bounds are inclusive; for descending order, the continuation predicate is `(workout_date, created_at, id) < (last_date, last_created_at, last_id)` under the same SQL filters. Fetch `limit + 1` **entries**, then their sets, to determine `hasMore` without splitting an entry across pages.
- Base64url JSON plus an unsigned canonical query hash detects mismatched parameters, **not** cursor tampering; no authentication, authorization or cryptographic integrity is claimed. Decode/validate safely. Immutable ordering keys are assumed for this create-only scope.
- `created_at` is ingestion time, not workout time.
- This is not snapshot pagination. New rows committed between page requests can appear before or after the cursor depending on their keys; edits to current exercise muscle-group metadata can also change filtered membership between pages. The API must not promise repeatable-read pagination semantics.
