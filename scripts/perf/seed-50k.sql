-- Representative, deterministic performance fixture.  Run with psql:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v entry_count=50000 \
--     -v perf_user_id='perf-50k-user' -f scripts/perf/seed-50k.sql
--
-- Requires the application schema to exist (start the app once with
-- DB_SYNCHRONIZE=true locally, or apply the project's migrations).  This script
-- only removes entries belonging to perf_user_id; exercises are shared catalog
-- data and are intentionally preserved.

\if :{?entry_count}
\else
\set entry_count 50000
\endif
\if :{?perf_user_id}
\else
\set perf_user_id 'perf-50k-user'
\endif

BEGIN;

DELETE FROM workout_entries WHERE user_id = :'perf_user_id';

INSERT INTO exercises (id, name, normalized_name, muscle_group, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Bench Press', 'bench press', 'chest', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'Back Squat', 'back squat', 'legs', now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'Deadlift', 'deadlift', 'back', now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'Overhead Press', 'overhead press', 'shoulders', now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'Barbell Row', 'barbell row', 'back', now(), now()),
  ('00000000-0000-4000-8000-000000000006', 'Leg Press', 'leg press', 'legs', now(), now()),
  ('00000000-0000-4000-8000-000000000007', 'Cable Fly', 'cable fly', NULL, now(), now()),
  ('00000000-0000-4000-8000-000000000008', 'Farmer Carry', 'farmer carry', NULL, now(), now())
ON CONFLICT (normalized_name) DO UPDATE
SET muscle_group = EXCLUDED.muscle_group, updated_at = now();

WITH generated AS (
  SELECT
    n,
    CASE
      -- Intentional date skew: 65% in 90 days, 25% in the preceding 640 days,
      -- and 10% older history.  This makes recent date filters non-uniform.
      WHEN n % 100 < 65 THEN DATE '2026-09-25' - (n % 90)
      WHEN n % 100 < 90 THEN DATE '2026-06-27' - (n % 640)
      ELSE DATE '2024-09-25' - (n % 730)
    END AS workout_date,
    CASE
      WHEN n % 10 < 3 THEN 'bench press'
      WHEN n % 10 < 5 THEN 'back squat'
      WHEN n % 10 = 5 THEN 'deadlift'
      WHEN n % 10 = 6 THEN 'overhead press'
      WHEN n % 10 = 7 THEN 'barbell row'
      WHEN n % 10 = 8 THEN 'leg press'
      WHEN n % 10 = 9 THEN 'cable fly'
    END AS normalized_name
  FROM generate_series(1, :entry_count::integer) AS n
)
INSERT INTO workout_entries (id, user_id, exercise_id, workout_date, created_at)
SELECT
  md5('everfit-perf-entry-' || n)::uuid,
  :'perf_user_id',
  e.id,
  workout_date,
  (workout_date::timestamp AT TIME ZONE 'UTC')
    + ((n % 86400) * interval '1 second')
    + ((n % 1000000) * interval '1 microsecond')
FROM generated g
JOIN exercises e ON e.normalized_name = g.normalized_name;

INSERT INTO workout_sets (id, workout_entry_id, set_order, reps, original_weight, original_unit, weight_kg)
SELECT
  md5('everfit-perf-set-' || e.id || '-' || s.set_order)::uuid,
  e.id,
  s.set_order,
  3 + (abs(hashtextextended(e.id::text, s.set_order + 17)) % 10),
  (40 + ((abs(hashtextextended(e.id::text, s.set_order)) % 161)))::numeric(12, 3),
  CASE WHEN s.set_order % 4 = 0 THEN 'lb' ELSE 'kg' END,
  CASE WHEN s.set_order % 4 = 0
    THEN round((40 + ((abs(hashtextextended(e.id::text, s.set_order)) % 161)))::numeric * 0.45359237, 6)
    ELSE (40 + ((abs(hashtextextended(e.id::text, s.set_order)) % 161)))::numeric
  END
FROM workout_entries e
CROSS JOIN LATERAL generate_series(1, 2 + (abs(hashtextextended(e.id::text, 0)) % 4)) AS s(set_order)
WHERE e.user_id = :'perf_user_id';

ANALYZE exercises;
ANALYZE workout_entries;
ANALYZE workout_sets;
COMMIT;

SELECT
  count(*) AS entries,
  count(DISTINCT exercise_id) AS exercises,
  min(workout_date) AS oldest_date,
  max(workout_date) AS newest_date
FROM workout_entries WHERE user_id = :'perf_user_id';
SELECT count(*) AS sets FROM workout_sets ws JOIN workout_entries we ON we.id = ws.workout_entry_id WHERE we.user_id = :'perf_user_id';
