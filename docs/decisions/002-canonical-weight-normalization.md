# ADR 002 — Canonical Weight Normalization

Status: proposed for implementation.

## Context

The API must accept kg/lb, preserve the original value/unit, store normalized kg, compare PRs consistently, return requested output units, and allow future units such as stone with minimal changes.

## Decision

Persist `original_weight`, `original_unit`, and canonical `weight_kg` for every set. Use decimal-safe arithmetic for conversion and PR ranking. Public JSON may expose normal numbers; winner selection must not depend on binary floating-point comparison.

## Rationale

Canonical kg gives one comparison basis independent of the submitted unit. Preserving the original input keeps auditability and lets responses or debugging show what the client actually sent. A unit registry/converter centralizes factors so new units are added without scattering conditionals through business logic.

## Consequences

- Conversion occurs at write time and is tested independently.
- PR selection always ranks canonical kg expressions first, then converts the selected result for display.
- Proposed P0 numeric contract for peer re-verification (not yet implemented): parse input as a finite JSON number in `[0, 100000]`, validate its normalized decimal **value** to at most 3 fractional places (not the raw token lexeme; trailing token zeros are not preserved), convert that normalized numeric value to a decimal string for decimal-library arithmetic, and store `original_weight NUMERIC(12,3)` alongside `weight_kg NUMERIC(15,6)`. Use exact `1 lb = 0.45359237 kg`, half-up rounding of canonical kg to 6 places and display weights/metrics to at most 3 places. Zero weight is allowed; reps are integers in `[1, 10000]`.
- Write-time canonical kg quantization to six decimals is part of persistence; PR ranking uses that persisted value. Later response-unit conversion/display rounding is presentation-only and must not change the winning PR row.
