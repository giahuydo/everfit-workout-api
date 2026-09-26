import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXERCISE_CATALOG_PATH,
  loadExerciseCatalog,
  parseExerciseCatalog,
} from '../exercise-catalog.js';

describe('exercise catalog', () => {
  it('loads the packaged JSON catalog by default', () => {
    expect(DEFAULT_EXERCISE_CATALOG_PATH).toMatch(
      /config[/\\]exercises\.json$/,
    );
    const catalog = loadExerciseCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog).toContainEqual({
      name: 'Bench Press',
      normalizedName: 'bench press',
      muscleGroup: 'chest',
    });
  });

  it('loads an override path and reports unreadable or malformed files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-'));
    const valid = join(dir, 'valid.json');
    writeFileSync(
      valid,
      JSON.stringify([{ name: ' Hip Thrust ', muscleGroup: ' glutes ' }]),
    );
    expect(loadExerciseCatalog(valid)).toEqual([
      {
        name: 'Hip Thrust',
        normalizedName: 'hip thrust',
        muscleGroup: 'glutes',
      },
    ]);

    const malformed = join(dir, 'malformed.json');
    writeFileSync(malformed, '[{');
    expect(() => loadExerciseCatalog(malformed)).toThrow(
      'Cannot read exercise catalog',
    );
    expect(() => loadExerciseCatalog(join(dir, 'missing.json'))).toThrow(
      'Cannot read exercise catalog',
    );
  });

  it('accepts null or omitted muscle groups', () => {
    expect(
      parseExerciseCatalog([
        { name: 'Plank', muscleGroup: null },
        { name: 'Carry' },
      ]),
    ).toEqual([
      { name: 'Plank', normalizedName: 'plank', muscleGroup: null },
      { name: 'Carry', normalizedName: 'carry', muscleGroup: null },
    ]);
  });

  it.each([
    ['a non-array document', { name: 'Plank' }, 'must be a JSON array'],
    ['a non-object entry', ['Plank'], 'must be an object'],
    [
      'an unsupported key',
      [{ name: 'Plank', group: 'core' }],
      'unsupported key',
    ],
    ['a blank name', [{ name: '   ' }], 'name must be a non-blank string'],
    ['a non-string name', [{ name: 42 }], 'name must be a non-blank string'],
    ['an overlong name', [{ name: 'x'.repeat(121) }], 'at most 120'],
    // U+0130 lowercases to two code points, so 120 input chars become 240.
    [
      'an overlong normalized name',
      [{ name: 'İ'.repeat(120) }],
      'too long after normalization',
    ],
    [
      'a blank muscle group',
      [{ name: 'Plank', muscleGroup: ' ' }],
      'muscleGroup must be',
    ],
    [
      'a non-string muscle group',
      [{ name: 'Plank', muscleGroup: 1 }],
      'muscleGroup must be',
    ],
    [
      'an overlong muscle group',
      [{ name: 'Plank', muscleGroup: 'x'.repeat(81) }],
      'at most 80',
    ],
    [
      'duplicate normalized names',
      [{ name: 'Bench Press' }, { name: ' bench press ' }],
      'duplicates normalized name',
    ],
  ])('rejects %s', (_label, data, message) => {
    expect(() => parseExerciseCatalog(data)).toThrow(message);
  });
});
