import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableTestDatabase } from './database-test-guard.js';

// Verifies the production schema path: a fresh database built only by the
// versioned initial migration, with the app booted under DB_SYNCHRONIZE=false.
const testDatabase = process.env.E2E_MIGRATIONS_DB_NAME ?? 'everfit_migrations_test';
const configuredApplicationDatabase = process.env.DB_NAME;
const dbConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? '55432'),
  user: process.env.DB_USER ?? 'everfit',
  password: process.env.DB_PASSWORD ?? 'everfit',
};

let app: INestApplication;
let migrationSource: DataSource;
let appliedMigrations: string[];

beforeAll(async () => {
  assertDisposableTestDatabase(testDatabase, configuredApplicationDatabase, 'E2E_MIGRATIONS_DB_NAME');
  const admin = new Client({ ...dbConfig, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${testDatabase}`);
  } finally {
    await admin.end();
  }

  process.env.DB_NAME = testDatabase;
  process.env.DB_SYNCHRONIZE = 'false';
  // The CLI data source reads DB_* at import time, so load it after the env is set.
  migrationSource = (await import('../src/database/data-source.js')).default;
  await migrationSource.initialize();
  appliedMigrations = (await migrationSource.runMigrations({ transaction: 'each' })).map((migration) => migration.name);

  const { AppModule } = await import('../src/app.module.js');
  const { HttpExceptionFilter } = await import('../src/common/http-exception.filter.js');
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
});

afterAll(async () => {
  await app?.close();
  if (migrationSource?.isInitialized) await migrationSource.destroy();
});

describe('migration-backed schema (DB_SYNCHRONIZE=false)', () => {
  it('applies the single versioned initial migration to a fresh database with nothing pending', async () => {
    expect(appliedMigrations).toEqual(migrationSource.migrations.map((migration) => migration.name));
    expect(await migrationSource.showMigrations()).toBe(false);
    const indexes = await migrationSource.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'workout_entries' ORDER BY indexname`,
    ) as Array<{ indexname: string }>;
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining(['idx_workout_entries_user_cursor', 'idx_workout_entries_user_exercise_date']),
    );
  });

  it('logs, pages history across md5(...)::uuid keys, and computes PRs on the migrated schema', async () => {
    const server = app.getHttpServer();
    const logged = await request(server).post('/v1/users/migration-user/workouts').send({
      date: '2026-09-24',
      exercises: [{ exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }, { reps: 8, weight: 200, unit: 'lb' }] }],
    });
    expect(logged.status).toBe(201);

    // Perf-fixture style rows: ids are md5(...)::uuid, valid PostgreSQL UUIDs
    // but not necessarily RFC 4122 v1-5. Identical keys force the id tie key.
    await migrationSource.query(`
      INSERT INTO workout_entries (id, user_id, exercise_id, workout_date, created_at)
      SELECT md5('migration-entry-' || n)::uuid, 'migration-user', e.id, DATE '2026-09-20', TIMESTAMPTZ '2026-09-20 10:00:00.123456+00'
      FROM generate_series(1, 3) AS n CROSS JOIN (SELECT id FROM exercises WHERE normalized_name = 'bench press') AS e`);
    await migrationSource.query(`
      INSERT INTO workout_sets (id, workout_entry_id, set_order, reps, original_weight, original_unit, weight_kg)
      SELECT md5('migration-set-' || we.id)::uuid, we.id, 1, 3, 60, 'kg', 60
      FROM workout_entries we WHERE we.user_id = 'migration-user' AND we.workout_date = DATE '2026-09-20'`);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query = cursor ? `limit=1&cursor=${encodeURIComponent(cursor)}` : 'limit=1';
      const page = await request(server).get(`/v1/users/migration-user/workouts?${query}`);
      expect(page.status).toBe(200);
      seen.push(...(page.body.items as Array<{ id: string }>).map((item) => item.id));
      cursor = page.body.page.nextCursor as string | null;
    } while (cursor && seen.length <= 10);

    const md5Ids = await migrationSource.query(
      `SELECT id FROM workout_entries WHERE user_id = 'migration-user' AND workout_date = DATE '2026-09-20' ORDER BY id DESC`,
    ) as Array<{ id: string }>;
    expect(seen).toEqual([logged.body.entries[0].id, ...md5Ids.map((row) => row.id)]);

    const records = await request(server).get('/v1/users/migration-user/personal-records?exerciseName=bench%20press&unit=kg');
    expect(records.status).toBe(200);
    expect(records.body).toEqual(expect.objectContaining({
      heaviestSet: expect.objectContaining({ weight: 100, reps: 5, achievedDate: '2026-09-24' }),
      highestVolume: expect.objectContaining({ value: 725.748, valueUnit: 'kg·reps' }),
    }));
  });
});
