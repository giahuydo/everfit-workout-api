# ADR 003 — Workout Date and Timezone Semantics

Status: accepted and implemented. `workout_date DATE` plus UTC `created_at TIMESTAMPTZ(6)`; no `performedAt`. Covered by calendar-date validation and inclusive-range e2e tests.

## Context

The assignment asks clients to submit a workout `date` and requires a documented timezone strategy. It does not require time-of-day or a client timezone.

## Decision

Store the submitted workout day as PostgreSQL `DATE` in `workout_date`. Store system timestamps such as `created_at` as UTC `TIMESTAMPTZ`. Do not fabricate a midnight timestamp or introduce `performedAt` unless a later product requirement supplies a real offset-bearing workout time.

## Rationale

A calendar date is the narrowest model that matches the input contract. Converting it into midnight UTC creates false precision and can confuse local-day semantics. UTC system timestamps remain appropriate for ingestion/audit ordering.

## Consequences

- Date-range filters operate on `workout_date` with inclusive endpoints; optional one-sided bounds apply to history/PR lookup, while comparison requires both bounds for each range.
- Multiple workouts on the same date cannot be ordered by actual workout time because that information is not collected.
- `created_at` can make same-date API ordering deterministic and intuitive, but it represents ingestion time, not the user's workout time.
- Month/range comparisons use explicit date boundaries supplied by the caller; the API does not infer coach locale.
