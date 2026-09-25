# Everfit Workout API — Implementation Plan

> **Historical planning snapshot, not current truth.** This plan was written on 2026-09-25 before any implementation (commit `8a542b3`) and is kept to show how the work was decomposed. Its "planned", "proposed", and "not passed" wording reflects that moment. For current behavior, see the root [README](../README.md), the code, the [ADRs](decisions/001-postgresql.md) (now accepted), [experiments](../notes/experiments.md), and the [improvement log](../notes/improvements-log.md). The actual commit titles and grouping differ from the planned ones; see `git log`.

**Status:** Planning draft. Source-to-plan mapping is complete for the supplied Everfit assignment checklist (items 1–12); implementation, testing, benchmarks, commits, GitHub delivery, README, AI workflow and video remain future work. A pre-start estimate was communicated externally; no number is restated here.

The complete A01–A102 requirement → design → phase → planned verification → deliverable matrix is in [internal traceability](../notes/requirement-traceability.md). Consult [API design](api-design.md), [database design](database-design.md), [architecture](architecture.md) and [ADRs](decisions/001-postgresql.md) for contracts and trade-offs.

## Assignment source vs our decisions

**Assignment requires:** Node.js; workout logging with `userId`, `date`, `exerciseName` and non-empty `sets[{reps,weight,unit}]`; kg/lb with original + normalized kg; multiple exercises/request. History by user supports partial name, date, optional muscle group if metadata exists, output unit and cursor **or** offset pagination. PRs are heaviest set, `reps×weight` volume and Epley `weight×(1+reps/30)`, each with achieved date and range comparison.

**Assignment edge/extensibility expectations:** Reject unsupported units and malformed/missing fields (including null date, negative weight/reps, empty sets); return no-data ranges as empty results with appropriate message, not an error. Document timezone strategy/trade-offs (UTC recommended), handle concurrent same-user/exercise writes, design for 50k+ entries/user, support a new unit such as stone with minimal changes, and make exercise→muscle-group mapping configurable.

**Assignment evaluation and delivery:** Justify PostgreSQL or MongoDB with schema/indexes; demonstrate efficient queries, REST/errors/validation/pagination/filtering, separation/extensibility/DI, PR/timezone/bulk correctness, graceful structured boundary errors, and unit/integration/edge **test design over coverage %**. Docker, structured logging, configuration and performance awareness matter. Deliver a GitHub repo with meaningful iterative history, README, `AI_WORKFLOW.md` documenting genuine reviewed AI work (≥2 wrong/suboptimal outputs with corrections, ≥1 rejected suggestion with reason), and a 15–20 minute English video: architecture decisions/why, all APIs including errors/edges, AI workflow, one real AI-generated piece line-by-line, and changes for 10k concurrent coaches. AI evaluation includes directing AI, finding wrong outputs, debugging, understanding, explaining and extending AI-written code. AI tools are encouraged; NestJS is recommended; a README diagram is a bonus. No auth is required; `userId` is passed as a parameter. Each obligation has its own [matrix row](../notes/requirement-traceability.md).

**Our design choices, not Everfit mandates:**
- One NestJS service, PostgreSQL + TypeORM, explicit migrations; no production schema sync. Three tables: `exercises`, `workout_entries`, `workout_sets`.
- Client `workout_date DATE`; UTC system `TIMESTAMPTZ`. Inclusive ranges; no invented workout time or inferred coach locale.
- Conservative exercise identity: outer trim + lowercase only; preserve internal whitespace, punctuation and diacritics. Exact normalized-name PR lookup; SQL literal substring history filter against the app-normalized name (escaped `LIKE`).
- Atomic multi-exercise POST; repeated same-user/exercise/day entries allowed. Original weight/unit + decimal-safe canonical kg; output unit defaults to kg.
- SQL-filtered history pages **entries** before sets; keyset cursor `(workout_date DESC, created_at DESC, id DESC)` bound to effective query parameters. No snapshot promise.
- SQL-selected PR winners ranked in canonical kg; tie order: earliest workout date, ingestion time, entry ID, set position, set ID. Convert/round only after winner selection.
- Valid no-data: HTTP 200 with empty/null data **and short message**. Zero weight allowed; reps positive integers. Add trigram/index optimizations only after representative query-plan evidence. No initial idempotency keys, Redis, microservices, replicas or partitioning.

## P0–P9 roadmap

**Every gate below is planned, not passed.** Commit titles describe possible future reviewable increments; no commit occurs in this docs-only pass. Keep rollback phase-scoped and account for dependent migrations.

### P0 — Contract baseline

Align API, schema, ADRs and this plan; freeze dates, exercise identity, decimal precision/rounding, no-data, cursor, PR ties and transaction boundary. Source traceability is complete in [A01–A102](../notes/requirement-traceability.md), but this does not pass P0.

- **Planned gate:** Independent cross-doc review finds no contract-changing unresolved assumption (see below).
- **Planned commit:** `docs: define API contract and implementation plan`

### P1 — Node/NestJS and PostgreSQL foundation

Scaffold NestJS, configuration validation, TypeORM data source/migrations, Compose PostgreSQL, health endpoint and injectable providers.

- **Planned gate:** Clean install/build/start, migrations up/down and health response from a clean checkout.
- **Planned commit:** `chore: bootstrap NestJS PostgreSQL environment`

### P2 — Schema and unit normalization

Implement tables, FKs/constraints/indexes, unique normalized exercise identity and configurable metadata storage. Use decimal-safe unit registry; retain original weight/unit and canonical kg.

- **Planned gate:** Migration/constraint, kg↔lb, precision, normalization/collision and concurrent exercise-resolution tests; demonstrate stone extension without scattered conditionals.
- **Planned commit:** `feat: add workout schema and unit normalization`

### P3 — Atomic workout logging

POST one date with multiple exercise occurrences and ordered sets. Validate route/body; resolve shared exercises safely; insert entire request in one transaction and allow same-day duplicates.

- **Planned gate:** Valid kg/lb, mixed-validity bulk rollback, unsupported unit, null date, negative weight/reps, zero/fractional reps policy, empty sets and concurrent same-user/exercise writes.
- **Planned commit:** `feat: implement atomic workout logging`

### P4 — Filtered history and cursor pagination

Filter in SQL by user, partial name, inclusive dates and optional muscle group; page entries before loading sets; convert output units; use versioned filter-bound keyset cursor.

- **Planned gate:** Each/combined filter (including Unicode case and literal `%`/`_`), missing metadata, unit conversion, dense same-date/microsecond-key pages, cursor mismatch, insert/metadata-change-between-pages behavior and no-data 200/message.
- **Planned commit:** `feat: add workout history filters and cursor pagination`

### P5 — PRs and range comparison

Exact normalized-name lookup; independently rank heaviest `weight_kg`, volume `reps×weight_kg`, Epley `weight_kg×(1+reps/30)` with decimal division. Report winning row date and compare two explicit ranges.

- **Planned gate:** Independently calculated fixtures, mixed units, tie order, inclusive range boundaries, empty/missing exercise 200/message, invalid range and winner unchanged by display unit.
- **Planned commit:** `feat: implement personal records and range comparison`

### P6 — Operational hardening

Add global structured errors/validation, request IDs, Pino logs, config/pool defaults, graceful shutdown, OpenAPI and multi-stage Docker; document absent auth and real-deployment access-control need.

- **Planned gate:** Structured/sanitized validation and server errors, invalid-env startup, log inspection, shutdown, Docker build/start and OpenAPI review.
- **Planned commit:** `chore: add production safeguards and API documentation`

### P7 — Adversarial tests and performance evidence

Design requirement-led unit/integration/e2e/edge fixtures (not coverage chasing). Review and debug AI-assisted code **if real code exists**. Seed 50k+ entries/user; record representative history/PR `EXPLAIN (ANALYZE, BUFFERS)` in [experiments](../notes/experiments.md), changing indexes only with evidence.

- **Planned gate:** Run tests, clean DB, concurrency fixtures, build/lint/type checks and query plans; document measured limits, not speculative throughput.
- **Planned commit:** `test: cover edge cases concurrency and query behavior`

### P8 — Documentation, AI workflow and English video

Root README: architecture (diagram bonus), reproducible `docker compose up` **or** clear steps, endpoint requests/responses/error codes, schema, trade-offs and scaling. Root `AI_WORKFLOW.md`: real tools/purposes across architecture/coding/testing/debugging/docs, ≥2 evidenced wrong/suboptimal outputs + corrections, ≥1 genuine rejected suggestion + reason, and real prompting context/decomposition/rules. Video: 15–20 minutes English, decisions/why, demo every API + edges/errors, AI workflow, real AI-generated code line-by-line, 10k-coach scaling.

- **Planned gate:** Follow README from fresh checkout; compare examples with actual responses; identify one genuinely AI-generated, provenance-checkable code section for the line-by-line walkthrough; confirm workflow evidence and deliver a finished, accessible 15–20 minute English recording/link after timed rehearsal. Missing real cases or recording remain unmet deliverables; never invent them.
- **Planned commit:** `docs: finalize architecture API and AI workflow`

### P9 — Clean-checkout submission

Verify intended GitHub repository contains code/docs, meaningful iterative history and reviewed/refined AI code (not blind copy-paste); fresh clone and follow README. Make only genuine corrections.

- **Planned gate:** Fresh-clone setup, migrations, build, tests, demo, AI/doc/video evidence and final git status.
- **Planned commit:** Only if a real final correction is required.

## Dependencies and decisions before implementation

`P0 → P1 → P2 → P3 → (P4, P5) → P6 → P7 → P8 → P9`. P2 schema/units underpin writes and reads; benchmark final query shapes after P4/P5; base final docs on verified P7 results. P6 operational work may proceed alongside features but must pass before delivery. Each phase should be independently reviewable.

**Proposed P0 contract for peer re-verification (not a passed P0 gate):**
- **Numeric:** input `weight` is a parsed finite JSON number in `[0, 100000]`, validated by normalized decimal **value** rather than raw token spelling; at most 3 fractional decimal places in that value (trailing token zeros do not count). Convert the normalized numeric value to a decimal string before decimal-library arithmetic; `reps` is an integer in `[1, 10000]`. Persist `original_weight NUMERIC(12,3)` and `weight_kg NUMERIC(15,6)`. Use exact decimal factor `1 lb = 0.45359237 kg`, round canonical kg to 6 decimals with half-up semantics, rank PRs on persisted canonical values, and serialize API weights/metrics as JSON numbers rounded to at most 3 display decimals.
- **Exercise metadata:** `exercises` is a shared global catalog for this take-home. `muscle_group` is nullable, populated by a small seed/config file rather than hardcoded business logic or an admin API. Matching is case-insensitive exact match after outer trim + lowercase. Metadata edits affect subsequent history filtering of past entries because the join reads current catalog metadata; this limitation is documented.
- **Exercise identity:** normalization is outer trim + Unicode lowercase only, implemented once in application code and persisted in `normalized_name`; PostgreSQL uniqueness uses deterministic `C` collation on that normalized key. Internal whitespace, punctuation and diacritics remain significant. Exercise names are stable identifiers in scope; no rename/alias workflow is implemented.
- **Concurrency:** logging uses one transaction. Under READ COMMITTED, for each distinct normalized exercise name in the request, attempt `INSERT ... ON CONFLICT DO NOTHING RETURNING`; if no row is returned, run a separate `SELECT` by normalized key using the same transaction manager. Logging never overwrites curated metadata. Same-day workouts remain append-only and are never deduplicated.
- **Bounds:** request body ≤ 256 KiB, ≤ 50 exercises/request, ≤ 50 sets/exercise, `exerciseName` ≤ 120 chars, `userId` ≤ 128 chars. History `limit` defaults to 20 and maxes at 100. DB pool/query/transaction timeouts are configuration values; no API-level idempotency key is added.
- **Cursor:** base64url-encoded versioned JSON contains sort keys (including `created_at` UTC ISO text with **six fractional digits**, losslessly round-tripped from `TIMESTAMPTZ(6)` without a millisecond JS Date) plus a canonical hash of `userId`, filters, output unit and limit. A cursor used with different effective parameters returns 400. The unsigned hash only detects query mismatch, not cursor tampering/integrity; the token is opaque but not secret or an authorization mechanism. HMAC signing is deferred unless tamper resistance is required. Pagination is deterministic on an unchanged dataset, not a cross-request snapshot.
- **PR/search/performance:** history substring search uses app-normalized term and escaped literal SQL `LIKE` against `normalized_name`; PR lookup is exact normalized name. PR winners are selected in SQL with explicit decimal arithmetic and deterministic tie order. P7 must seed ≥50k entries for one user with realistic sets and mixed metadata, record `EXPLAIN (ANALYZE, BUFFERS)` for unfiltered/filtered first+deep history pages and PR queries, and either show acceptable indexed plans without obvious full-user sort/scan pathologies or document the limitation and adjust query/indexes before claiming the 50k target.

`created_at` is ingestion, not workout time; cursor paging is not a snapshot (including across catalog metadata edits). The assignment leaves auth unspecified; this take-home omits it, but a real deployment needs access control.

**Evidence boundary:** Detailed obligations, planned tests and deliverables are in [A01–A102](../notes/requirement-traceability.md). No application tests, benchmarks, GitHub submission, README, AI code-case evidence or video are claimed complete. Log only real AI findings in [the findings log](../notes/ai-findings.md); never invent mistakes, rejections, commits, extensions or measurements.
