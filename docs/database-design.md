# Database Design

Originally written as the planned design; the implemented schema is `src/database/migrations/1770000000000-initial-schema.ts`, and where the two differ, the migration is authoritative. Every UUID primary key defaults to `uuid_generate_v4()` (`uuid-ossp` extension) so application inserts, including catalog seeding, need not supply IDs.

PostgreSQL with TypeORM entities and **explicit versioned migrations**; do not use production `synchronize`. See [API design](api-design.md) for public contracts. A user ID is an opaque external key; there is no users table or authorization in this scope.

## Tables

### `exercises`
- `id` UUID primary key.
- `name` text/varchar: preserved display spelling from first creation (later spelling variants do not rename it implicitly).
- `normalized_name` text/varchar unique: trim surrounding whitespace + lowercase only. Use the *same* normalization for insert, exact PR lookup, and concurrent conflict handling; reject empty normalized names. Application normalization is the source of truth; store the normalized key with deterministic PostgreSQL `C` collation so uniqueness does not depend on deployment locale. Names are stable identifiers in this scope; aliases/renames are deferred.
- `muscle_group` nullable varchar(80): configurable global catalog metadata loaded from a seed/config file. Matching is outer trim + lowercase exact equality. No admin API is added in this take-home; metadata edits affect subsequent filtering of historical entries because reads join current catalog metadata.
- `created_at`, `updated_at` UTC `TIMESTAMPTZ` system timestamps.

### `workout_entries`
- `id` UUID primary key.
- `user_id` varchar(128): non-blank opaque caller-supplied identifier.
- `exercise_id` UUID foreign key to `exercises`.
- `workout_date` PostgreSQL `DATE`: client-supplied calendar day, not a fabricated timestamp.
- `created_at` UTC `TIMESTAMPTZ(6)`: ingestion time with PostgreSQL microsecond precision, assigned by database/service consistently. Ordering keys are immutable in this scope; cursor serialization must preserve all six fractional digits.

One entry per exercise occurrence in a bulk request; multiple identical exercise names and same-day entries are allowed. There is deliberately no uniqueness constraint on `(user_id, exercise_id, workout_date)`.

### `workout_sets`
- `id` UUID primary key.
- `workout_entry_id` UUID foreign key with cascade delete.
- `set_order` positive `smallint` (1-based submitted position), unique per entry (`uq_workout_sets_entry_order`, `UNIQUE(workout_entry_id, set_order)`).
- `reps` positive integer, `1..10000`.
- `original_weight NUMERIC(12,3)`, range `0..100000`.
- `original_unit` supported code, initially `kg`/`lb`.
- `weight_kg NUMERIC(15,6)`, converted with exact factor `1 lb = 0.45359237 kg` and rounded half-up to 6 decimals at write time.

Check constraints should enforce basic positivity/non-negativity and valid dates/foreign keys even if application DTOs validate first. Do not hard-code a kg/lb-only SQL enum/check that makes adding a unit require scattered schema changes; unit validation belongs in a centralized registry with deliberate rollout. The proposed P0 numeric contract before migrations: parsed finite JSON-number weights in `[0, 100000]` are validated by normalized decimal **value** (not raw token lexeme) with at most 3 fractional places; trailing zeros such as `1.0000` do not create extra value precision. Convert the normalized numeric value to a decimal string before decimal-library arithmetic; reject values with additional nonzero decimals (e.g. `0.0001`). Original weight stores 3 places, canonical kg stores 6, PR ranking uses persisted canonical values, and response half-up rounding to at most 3 places is presentation-only. PostgreSQL `NUMERIC`/decimal libraries, not JS binary floats, perform comparison arithmetic; JSON numbers remain the public transport format.

## Transaction and concurrent exercise resolution

One logging request is one database transaction: validate first, normalize names, create or retrieve exercises through a unique-key-safe upsert/conflict path, then insert all entries/sets. Under PostgreSQL **READ COMMITTED**, for each distinct normalized name run `INSERT ... ON CONFLICT DO NOTHING RETURNING`; when no row is returned, perform a **separate statement** `SELECT` by normalized key using the same transaction manager. This avoids check-then-insert races and same-statement visibility surprises. If any insert/validation fails, roll back the entire request. Metadata conflicts on concurrent upserts must not silently replace a curated value. Repeated same-day logging is permitted (no idempotency guarantee).

## Planned indexes and query shapes

- Unique B-tree `exercises(normalized_name)` for identity and exact PR lookup.
- B-tree `workout_entries(user_id, workout_date DESC, created_at DESC, id DESC)` for unfiltered user history.
- B-tree `workout_entries(user_id, exercise_id, workout_date DESC, created_at DESC, id DESC)` for exercise-scoped entry retrieval/date ranges; validate PR plan against joins and set scans.
- B-tree `workout_sets(workout_entry_id)` for entry→set retrieval (implemented: the unique `(workout_entry_id, set_order)` constraint covers this prefix, so no separate index was added).

History is filtered in SQL before paging **entries**, not joined set rows; select `limit + 1` entry IDs then fetch their sets in `set_order` order. Optional exercise-name substring and muscle-group predicates require joining `exercises`. For a partial name filter, normalize the search term in application code identically to exercise identity, escape `LIKE` wildcards `%`, `_` and `\`, and apply literal `%term%` `LIKE ... ESCAPE '\'` to `exercises.normalized_name` under its deterministic `C` collation (not locale-dependent `ILIKE` over the display name). A leading-wildcard `LIKE` cannot use a normal B-tree for the substring predicate; an indexed user/date path may still be adequate. Do not add `pg_trgm` by default. Collect representative `EXPLAIN (ANALYZE, BUFFERS)` for the actual filters, deep pages, and 50k+ entries/user, then consider trigram/search indexes or query changes if warranted. Indexes are hypotheses, not throughput guarantees.

PR candidate sets join entries and exercises; filter by `user_id`, **exact** `normalized_name`, and inclusive `workout_date` bounds. Rank independently for each metric on canonical kg:

- heaviest: `weight_kg`
- volume: `reps * weight_kg`
- Epley: `weight_kg * (1 + reps::NUMERIC / 30::NUMERIC)` with explicit decimal division (never integer or JS binary-float division)

Use metric DESC then `workout_date ASC, created_at ASC, workout_entry.id ASC, set_order ASC, workout_set.id ASC`; a unique final set ID closes any tie. The winner's `workout_date` is `achievedDate`, not proof of the first real-world occurrence. Convert/round **after** winner selection. Compare ranges with the same query rules, independently. An empty candidate set returns null metrics, not an exception.
