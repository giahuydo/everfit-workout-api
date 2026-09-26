# ADR 003 — Workout Date and Timezone Semantics

**Status:** Accepted and implemented.

## Context

The assignment accepts a workout `date` and asks for a documented timezone strategy. It does not provide time-of-day or client timezone/offset.

## Decision

Store the submitted workout day as PostgreSQL `DATE` (`workout_date`). Store system timestamps such as `created_at` as UTC `TIMESTAMPTZ(6)`. Do not invent midnight UTC or add `performedAt` unless a future product requirement supplies a real offset-bearing workout time.

## Why

A calendar date is the narrowest faithful representation of the input. Converting `2026-09-25` into a timestamp would create precision and timezone meaning that the caller never supplied.

`created_at` is still useful for audit/ingestion ordering and deterministic pagination, but it must never be described as the workout time.

## Consequences

- date filters are inclusive calendar comparisons;
- history/PR may use one-sided bounds; comparison requires explicit bounds for both ranges;
- two workouts on the same date cannot be ordered by actual workout time;
- same-day API ordering uses ingestion time as a technical tie-break;
- month comparisons are caller-defined; the API does not infer coach locale.

## Evidence

Calendar-date validation, year-zero rejection, inclusive-range E2E, and microsecond cursor tests cover the implemented semantics.
