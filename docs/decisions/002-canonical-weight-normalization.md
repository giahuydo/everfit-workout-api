# ADR 002 — Canonical Weight Normalization

**Status:** Accepted and implemented.

## Context

The API must accept kg/lb, retain the original measurement, store normalized kg, compare PRs across mixed units, return a requested output unit, and make future units such as stone cheap to add.

## Decision

Store three measurement fields for every set:

- `original_weight NUMERIC(12,3)`;
- `original_unit`;
- `weight_kg NUMERIC(15,6)` as the canonical calculation value.

Use decimal-safe arithmetic for conversion. Public JSON remains numeric. PR ranking always uses persisted canonical kg before display conversion or rounding.

## Why

```text
input value/unit ──► preserve original measurement
       │
       └───────────► convert once to canonical kg ──► history / volume / 1RM ranking
```

One canonical unit prevents kg/lb inputs from changing winner selection. Keeping the original value preserves what the caller actually submitted. A shared unit registry keeps conversion factors out of business logic.

## Numeric rules

- input weight: finite JSON number `0..100000`;
- meaningful decimal precision: at most 3 places;
- exact factor: `1 lb = 0.45359237 kg`;
- canonical persistence: half-up to 6 decimal places;
- display: half-up to at most 3 decimal places;
- reps: integer `1..10000`;
- zero weight is allowed.

`highestVolume` multiplies persisted canonical kg by reps and rounds/converts the total once; display rounding never participates in winner selection.

## Consequences

Adding another unit is a registry/factor change rather than new conditionals in every endpoint. Write-time six-decimal kg quantization is part of persistence semantics, so future changes to that precision would require an explicit data/contract decision.

## Evidence

Mixed-unit history/PR E2E, unit contract tests, and the volume-rounding regression cover the implemented behavior. See [`notes/improvements-log.md`](../../notes/improvements-log.md).
