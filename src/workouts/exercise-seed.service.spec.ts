import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseSeedService } from './exercise-seed.service.js';

function fakeRepo() {
  const builder = {
    insert: vi.fn().mockReturnThis(),
    into: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    orIgnore: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return { builder, repo: { createQueryBuilder: () => builder } };
}

describe('ExerciseSeedService', () => {
  it('inserts configured rows in normalized order without overwriting existing rows', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'seed-')), 'exercises.json');
    writeFileSync(path, JSON.stringify([{ name: 'Row', muscleGroup: 'back' }, { name: 'Curl', muscleGroup: null }]));
    const { builder, repo } = fakeRepo();
    const config = { get: vi.fn().mockReturnValue(path) };

    await new ExerciseSeedService(repo as never, config as never).onModuleInit();

    expect(config.get).toHaveBeenCalledWith('EXERCISE_CATALOG_PATH');
    expect(builder.values.mock.calls).toEqual([
      [{ name: 'Curl', normalizedName: 'curl', muscleGroup: null }],
      [{ name: 'Row', normalizedName: 'row', muscleGroup: 'back' }],
    ]);
    expect(builder.orIgnore).toHaveBeenCalledTimes(2);
  });

  it('fails startup before writing when the catalog is invalid', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'seed-')), 'exercises.json');
    writeFileSync(path, JSON.stringify([{ name: 'Row' }, { name: 'ROW' }]));
    const { builder, repo } = fakeRepo();

    await expect(
      new ExerciseSeedService(repo as never, { get: () => path } as never).onModuleInit(),
    ).rejects.toThrow('duplicates normalized name');
    expect(builder.execute).not.toHaveBeenCalled();
  });
});
