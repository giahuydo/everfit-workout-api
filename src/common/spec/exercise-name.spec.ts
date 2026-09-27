import { describe, expect, it } from 'vitest';
import {
  escapeLike,
  hasValidNormalizedExerciseNameLength,
  normalizeExerciseName,
} from '../exercise-name.js';

describe('exercise name helpers', () => {
  it('normalizes only outer whitespace and case', () => {
    expect(normalizeExerciseName('  Bench Press  ')).toBe('bench press');
    // Internal spacing and punctuation stay significant identity.
    expect(normalizeExerciseName('Bench  Press')).toBe('bench  press');
    expect(normalizeExerciseName('Pull-Up')).not.toBe(normalizeExerciseName('Pull Up'));
  });

  it('escapes LIKE wildcards so history search is literal', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(escapeLike('bench')).toBe('bench');
  });

  it('counts the normalized length, which can grow after lowercasing', () => {
    expect(hasValidNormalizedExerciseNameLength('a'.repeat(120))).toBe(true);
    expect(hasValidNormalizedExerciseNameLength('a'.repeat(121))).toBe(false);
    expect(hasValidNormalizedExerciseNameLength('')).toBe(false);
    // 'İ' lowercases to two code points: 61 input chars become 122.
    const turkish = 'İ'.repeat(61);
    expect(Array.from(turkish)).toHaveLength(61);
    expect(hasValidNormalizedExerciseNameLength(normalizeExerciseName(turkish))).toBe(false);
  });
});
