import { describe, expect, it } from 'vitest';
import type { QueryRunner } from 'typeorm';
import { InitialSchema1770000000000 } from './1770000000000-initial-schema.js';

describe('InitialSchema1770000000000', () => {
  it('creates UUID-generating primary keys for application inserts and reverses dependent tables first', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (query: string) => {
        queries.push(query);
      },
    } as unknown as QueryRunner;
    const migration = new InitialSchema1770000000000();

    await migration.up(queryRunner);

    expect(queries[0]).toBe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    for (const table of ['exercises', 'workout_entries', 'workout_sets']) {
      const createTable = queries.find((query) =>
        query.startsWith(`CREATE TABLE "${table}"`),
      );
      expect(createTable).toContain(
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4()',
      );
      expect(createTable).toContain(
        `CONSTRAINT "pk_${table}" PRIMARY KEY ("id")`,
      );
    }

    await migration.down(queryRunner);

    expect(queries.slice(-3)).toEqual([
      'DROP TABLE "workout_sets"',
      'DROP TABLE "workout_entries"',
      'DROP TABLE "exercises"',
    ]);
    expect(queries).not.toContain('DROP EXTENSION "uuid-ossp"');
  });
});
