import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertDisposableTestDatabase } from './database-test-guard.js';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';

const testDatabase = process.env.E2E_DB_NAME ?? 'everfit_workflows_test';
const configuredApplicationDatabase = process.env.DB_NAME;
const dbConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? '55432'),
  user: process.env.DB_USER ?? 'everfit',
  password: process.env.DB_PASSWORD ?? 'everfit',
};

let app: INestApplication;
let dataSource: DataSource;

function workout(exerciseName: string, sets: unknown[], date = '2026-09-25') {
  return { date, exercises: [{ exerciseName, sets }] };
}

async function postWorkout(userId: string, body: unknown): Promise<Response> {
  return request(app.getHttpServer()).post(`/v1/users/${userId}/workouts`).send(body as object);
}

async function seedWorkout(
  userId: string,
  exerciseName: string,
  sets: Array<{ reps: number; weight: number; unit: 'kg' | 'lb' }>,
  date: string,
) {
  const response = await postWorkout(userId, workout(exerciseName, sets, date));
  expect(response.status).toBe(201);
  return response.body.entries[0] as { id: string; sets: Array<{ id: string }> };
}

async function setMuscleGroup(exerciseName: string, muscleGroup: string) {
  await dataSource.query(
    'UPDATE exercises SET muscle_group = $1 WHERE normalized_name = $2',
    [muscleGroup, exerciseName.trim().toLowerCase()],
  );
}

async function count(table: 'exercises' | 'workout_entries' | 'workout_sets') {
  const result = await dataSource.query(`SELECT count(*)::int AS count FROM ${table}`) as Array<{ count: number }>;
  return result[0].count;
}

function expectValidationFailure(response: Response) {
  expect(response.status).toBe(400);
  expect(response.body).toEqual(expect.objectContaining({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: expect.any(String),
    details: expect.any(Array),
    requestId: expect.any(String),
  }));
}

beforeAll(async () => {
  assertDisposableTestDatabase(testDatabase, configuredApplicationDatabase, 'E2E_DB_NAME');
  const admin = new Client({ ...dbConfig, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${testDatabase}`);
  } finally {
    await admin.end();
  }

  process.env.DB_NAME = testDatabase;
  process.env.DB_SYNCHRONIZE = 'true';
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  }));
  app.useGlobalFilters(app.get(HttpExceptionFilter));
  await app.init();
  dataSource = app.get(DataSource);
});

beforeEach(async () => {
  await dataSource.query('TRUNCATE TABLE workout_sets, workout_entries, exercises RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await app?.close();
});

describe('workout assignment workflows', () => {
  it('logs a multi-exercise request atomically and preserves submitted set order', async () => {
    const response = await postWorkout('bulk-user', {
      date: '2026-09-25',
      exercises: [
        { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }, { reps: 8, weight: 80, unit: 'lb' }] },
        { exerciseName: 'Back Squat', sets: [{ reps: 3, weight: 140, unit: 'kg' }] },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      entries: [
        { id: expect.any(String), exerciseName: 'Bench Press', date: '2026-09-25', sets: [
          { id: expect.any(String), reps: 5, weight: 100, unit: 'kg' },
          { id: expect.any(String), reps: 8, weight: 80, unit: 'lb' },
        ] },
        { id: expect.any(String), exerciseName: 'Back Squat', date: '2026-09-25', sets: [
          { id: expect.any(String), reps: 3, weight: 140, unit: 'kg' },
        ] },
      ],
    });
    expect(await count('workout_entries')).toBe(2);
    expect(await count('workout_sets')).toBe(3);
  });

  it('rolls back the entire bulk request when any exercise is invalid', async () => {
    const response = await postWorkout('rollback-user', {
      date: '2026-09-25',
      exercises: [
        { exerciseName: 'Valid First', sets: [{ reps: 5, weight: 80, unit: 'kg' }] },
        { exerciseName: 'Invalid Second', sets: [{ reps: 5, weight: 80, unit: 'stone' }] },
      ],
    });

    expectValidationFailure(response);
    expect(await count('workout_entries')).toBe(0);
    expect(await count('workout_sets')).toBe(0);
    expect(await count('exercises')).toBe(0);
  });

  it.each([
    ['invalid unit', workout('Bench Press', [{ reps: 5, weight: 80, unit: 'stone' }])],
    ['non-calendar date', workout('Bench Press', [{ reps: 5, weight: 80, unit: 'kg' }], '2026-02-30')],
    ['null weight', workout('Bench Press', [{ reps: 5, weight: null, unit: 'kg' }])],
    ['negative weight', workout('Bench Press', [{ reps: 5, weight: -1, unit: 'kg' }])],
    ['negative reps', workout('Bench Press', [{ reps: -1, weight: 1, unit: 'kg' }])],
    ['empty exercises', { date: '2026-09-25', exercises: [] }],
    ['empty sets', workout('Bench Press', [])],
    ['numeric-string weight', workout('Bench Press', [{ reps: 5, weight: '80', unit: 'kg' }])],
  ])('rejects %s without persisting anything', async (_label, body) => {
    const response = await postWorkout('validation-user', body);
    expectValidationFailure(response);
    expect(await count('workout_entries')).toBe(0);
  });

  it('stores original units with six-decimal canonical kg and converts history output', async () => {
    await seedWorkout('units-user', 'Mixed Units', [
      { reps: 5, weight: 100, unit: 'lb' },
      { reps: 5, weight: 100, unit: 'kg' },
    ], '2026-09-25');
    const stored = await dataSource.query(
      'SELECT original_weight, original_unit, weight_kg FROM workout_sets ORDER BY set_order',
    ) as Array<{ original_weight: string; original_unit: string; weight_kg: string }>;
    expect(stored).toEqual([
      { original_weight: '100.000', original_unit: 'lb', weight_kg: '45.359237' },
      { original_weight: '100.000', original_unit: 'kg', weight_kg: '100.000000' },
    ]);

    const response = await request(app.getHttpServer()).get('/v1/users/units-user/workouts?unit=lb');
    expect(response.status).toBe(200);
    expect(response.body.items[0].sets.map((set: { weight: number; unit: string }) => [set.weight, set.unit]))
      .toEqual([[100, 'lb'], [220.462, 'lb']]);
  });

  it('filters history by literal partial name, inclusive dates, and current muscle group', async () => {
    await seedWorkout('history-user', 'Bench Press', [{ reps: 5, weight: 100, unit: 'kg' }], '2026-09-20');
    await seedWorkout('history-user', 'Incline Bench Press', [{ reps: 8, weight: 80, unit: 'kg' }], '2026-09-21');
    await seedWorkout('history-user', 'Back Squat', [{ reps: 3, weight: 140, unit: 'kg' }], '2026-09-22');
    await setMuscleGroup('Bench Press', 'Chest');
    await setMuscleGroup('Incline Bench Press', 'Chest');
    await setMuscleGroup('Back Squat', 'Legs');

    const response = await request(app.getHttpServer())
      .get('/v1/users/history-user/workouts?exerciseName=bench&from=2026-09-20&to=2026-09-21&muscleGroup=CHEST&unit=kg');
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { exerciseName: string; date: string }) => [item.exerciseName, item.date]))
      .toEqual([['Incline Bench Press', '2026-09-21'], ['Bench Press', '2026-09-20']]);
  });

  it('returns a successful documented no-data history page', async () => {
    const response = await request(app.getHttpServer()).get('/v1/users/no-history-user/workouts?from=2026-01-01&to=2026-01-31');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      page: { limit: 20, hasMore: false, nextCursor: null },
      message: expect.stringMatching(/no workouts found/i),
    });
  });

  it('returns the documented cursor page shape and a valid exhausted no-data page', async () => {
    await seedWorkout('cursor-user', 'Cursor Lift', [{ reps: 5, weight: 50, unit: 'kg' }], '2026-09-22');
    await seedWorkout('cursor-user', 'Cursor Lift', [{ reps: 5, weight: 60, unit: 'kg' }], '2026-09-23');
    const first = await request(app.getHttpServer()).get('/v1/users/cursor-user/workouts?limit=1');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      items: [expect.objectContaining({ id: expect.any(String), createdAt: expect.stringMatching(/Z$/) })],
      page: { limit: 1, hasMore: true, nextCursor: expect.any(String) },
    });

    const cursor = first.body.page.nextCursor as string;
    const second = await request(app.getHttpServer()).get(`/v1/users/cursor-user/workouts?limit=1&cursor=${encodeURIComponent(cursor)}`);
    expect(second.status).toBe(200);
    expect(second.body.page).toEqual({ limit: 1, hasMore: false, nextCursor: null });
    const exhausted = await request(app.getHttpServer()).get(`/v1/users/cursor-user/workouts?limit=1&cursor=${encodeURIComponent(second.body.page.nextCursor ?? cursor)}`);
    expect(exhausted.status).toBe(200);
  });

  it('rejects malformed and scope-mismatched history cursors', async () => {
    await seedWorkout('cursor-scope-user', 'Cursor Lift', [{ reps: 5, weight: 50, unit: 'kg' }], '2026-09-25');
    await seedWorkout('cursor-scope-user', 'Cursor Lift', [{ reps: 5, weight: 60, unit: 'kg' }], '2026-09-24');
    const malformed = await request(app.getHttpServer()).get('/v1/users/cursor-scope-user/workouts?cursor=not-a-cursor');
    expectValidationFailure(malformed);

    const first = await request(app.getHttpServer()).get('/v1/users/cursor-scope-user/workouts?limit=1');
    const scoped = await request(app.getHttpServer())
      .get(`/v1/users/another-user/workouts?limit=1&cursor=${encodeURIComponent(first.body.page.nextCursor as string)}`);
    expectValidationFailure(scoped);
  });

  it('keeps concurrent same-user/exercise writes as separate entries', async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => postWorkout(
      'concurrent-user', workout('Concurrent Row', [{ reps: 5 + index, weight: 70 + index, unit: 'kg' }]),
    )));
    expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201, 201, 201]);
    expect(await count('workout_entries')).toBe(6);
    expect(await count('workout_sets')).toBe(6);
  });

  it('creates exactly one shared exercise when concurrent first-use requests normalize to one name', async () => {
    const responses = await Promise.all([
      postWorkout('first-use-a', workout('  First Use Lift  ', [{ reps: 5, weight: 70, unit: 'kg' }])),
      postWorkout('first-use-b', workout('first use lift', [{ reps: 5, weight: 70, unit: 'kg' }])),
    ]);
    expect(responses.map((response) => response.status).sort((left, right) => left - right)).toEqual([201, 201]);
    expect(await count('exercises')).toBe(1);
    expect(await count('workout_entries')).toBe(2);
  });

  it('selects canonical-kg PR winners for heaviest, volume, Epley, mixed units, and deterministic ties', async () => {
    await seedWorkout('pr-user', 'PR Lift', [
      { reps: 10, weight: 100, unit: 'kg' },
      { reps: 1, weight: 220.462, unit: 'lb' },
    ], '2026-09-20');
    const later = await seedWorkout('pr-user', 'PR Lift', [
      { reps: 5, weight: 110, unit: 'kg' },
      { reps: 1, weight: 110, unit: 'kg' },
    ], '2026-09-21');

    const response = await request(app.getHttpServer()).get('/v1/users/pr-user/personal-records?exerciseName=pr%20lift&unit=kg');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      heaviestSet: {
        entryId: later.id,
        setId: later.sets[0].id,
        reps: 5,
        weight: 110,
        unit: 'kg',
        value: 110,
        valueUnit: 'kg',
        achievedDate: '2026-09-21',
      },
      highestVolume: expect.objectContaining({ value: 1000, valueUnit: 'kg·reps', achievedDate: '2026-09-20' }),
      estimatedOneRepMax: expect.objectContaining({ value: 133.333, valueUnit: 'kg', achievedDate: '2026-09-20' }),
    });
  });

  it('returns null PR metrics for no data and compares independently bounded ranges', async () => {
    const none = await request(app.getHttpServer()).get('/v1/users/no-pr-user/personal-records?exerciseName=unknown');
    expect(none.status).toBe(200);
    expect(none.body).toEqual({
      heaviestSet: null,
      highestVolume: null,
      estimatedOneRepMax: null,
      message: expect.stringMatching(/no personal records/i),
    });

    await seedWorkout('compare-user', 'Compare Lift', [{ reps: 5, weight: 100, unit: 'kg' }], '2026-08-10');
    await seedWorkout('compare-user', 'Compare Lift', [{ reps: 5, weight: 120, unit: 'kg' }], '2026-09-10');
    const comparison = await request(app.getHttpServer()).get(
      '/v1/users/compare-user/personal-records/compare?exerciseName=Compare%20Lift&rangeAFrom=2026-09-01&rangeATo=2026-09-30&rangeBFrom=2026-08-01&rangeBTo=2026-08-31&unit=kg',
    );
    expect(comparison.status).toBe(200);
    expect(comparison.body).toEqual({
      rangeA: expect.objectContaining({ from: '2026-09-01', to: '2026-09-30', records: expect.objectContaining({ heaviestSet: expect.objectContaining({ value: 120 }) }) }),
      rangeB: expect.objectContaining({ from: '2026-08-01', to: '2026-08-31', records: expect.objectContaining({ heaviestSet: expect.objectContaining({ value: 100 }) }) }),
    });
  });
});
