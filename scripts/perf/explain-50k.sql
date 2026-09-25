-- Run after seed-50k.sql.  Output is deliberately suitable for committing as
-- evidence: psql prints actual planning/execution time and buffer usage.
\set ON_ERROR_STOP on
\if :{?perf_user_id}
\else
\set perf_user_id 'perf-50k-user'
\endif

\echo === index state ===
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('workout_entries', 'workout_sets', 'exercises') ORDER BY tablename, indexname;

\echo === history: unfiltered first page ===
EXPLAIN (ANALYZE, BUFFERS)
SELECT we.id, we.user_id, we.exercise_id, we.workout_date, we.created_at, e.name, e.muscle_group
FROM workout_entries we JOIN exercises e ON e.id = we.exercise_id
WHERE we.user_id = :'perf_user_id'
ORDER BY we.workout_date DESC, we.created_at DESC, we.id DESC LIMIT 51;

\echo === history: partial-name + date + muscle filter ===
EXPLAIN (ANALYZE, BUFFERS)
SELECT we.id, we.user_id, we.exercise_id, we.workout_date, we.created_at, e.name, e.muscle_group
FROM workout_entries we JOIN exercises e ON e.id = we.exercise_id
WHERE we.user_id = :'perf_user_id'
  AND we.workout_date >= DATE '2026-07-01' AND we.workout_date <= DATE '2026-09-25'
  AND e.normalized_name LIKE '%press%' ESCAPE '\'
  AND LOWER(e.muscle_group) = 'chest'
ORDER BY we.workout_date DESC, we.created_at DESC, we.id DESC LIMIT 51;

-- Obtain an actual key from the representative user's 25,001st row.  The
-- following predicate is the service's expanded tuple keyset predicate.
SELECT workout_date AS cursor_date, created_at AS cursor_created_at, id AS cursor_id
FROM workout_entries WHERE user_id = :'perf_user_id'
ORDER BY workout_date DESC, created_at DESC, id DESC OFFSET 25000 LIMIT 1 \gset

\echo === history: deep keyset page (after row 25,001) ===
EXPLAIN (ANALYZE, BUFFERS)
SELECT we.id, we.user_id, we.exercise_id, we.workout_date, we.created_at, e.name, e.muscle_group
FROM workout_entries we JOIN exercises e ON e.id = we.exercise_id
WHERE we.user_id = :'perf_user_id'
  AND (we.workout_date < :'cursor_date'::date
    OR (we.workout_date = :'cursor_date'::date AND we.created_at < :'cursor_created_at'::timestamptz)
    OR (we.workout_date = :'cursor_date'::date AND we.created_at = :'cursor_created_at'::timestamptz AND we.id < :'cursor_id'::uuid))
ORDER BY we.workout_date DESC, we.created_at DESC, we.id DESC LIMIT 51;

-- These are the three independent SQL shapes in PersonalRecordsService.
\echo === PR: heaviest ===
EXPLAIN (ANALYZE, BUFFERS)
SELECT ws.id, we.id, we.workout_date, we.created_at, ws.set_order, ws.reps, ws.weight_kg
FROM workout_sets ws JOIN workout_entries we ON we.id = ws.workout_entry_id JOIN exercises e ON e.id = we.exercise_id
WHERE we.user_id = :'perf_user_id' AND e.normalized_name = 'bench press'
  AND we.workout_date >= DATE '2024-01-01' AND we.workout_date <= DATE '2026-09-25'
ORDER BY ws.weight_kg DESC, we.workout_date ASC, we.created_at ASC, we.id ASC, ws.set_order ASC LIMIT 1;

\echo === PR: highest volume ===
EXPLAIN (ANALYZE, BUFFERS)
SELECT ws.id, we.id, we.workout_date, we.created_at, ws.set_order, ws.reps, ws.weight_kg
FROM workout_sets ws JOIN workout_entries we ON we.id = ws.workout_entry_id JOIN exercises e ON e.id = we.exercise_id
WHERE we.user_id = :'perf_user_id' AND e.normalized_name = 'bench press'
  AND we.workout_date >= DATE '2024-01-01' AND we.workout_date <= DATE '2026-09-25'
ORDER BY (ws.reps::numeric * ws.weight_kg) DESC, we.workout_date ASC, we.created_at ASC, we.id ASC, ws.set_order ASC LIMIT 1;

\echo === PR: estimated 1RM ===
EXPLAIN (ANALYZE, BUFFERS)
SELECT ws.id, we.id, we.workout_date, we.created_at, ws.set_order, ws.reps, ws.weight_kg
FROM workout_sets ws JOIN workout_entries we ON we.id = ws.workout_entry_id JOIN exercises e ON e.id = we.exercise_id
WHERE we.user_id = :'perf_user_id' AND e.normalized_name = 'bench press'
  AND we.workout_date >= DATE '2024-01-01' AND we.workout_date <= DATE '2026-09-25'
ORDER BY (ws.weight_kg * (1::numeric + ws.reps::numeric / 30::numeric)) DESC, we.workout_date ASC, we.created_at ASC, we.id ASC, ws.set_order ASC LIMIT 1;
