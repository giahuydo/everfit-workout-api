import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasValidNormalizedExerciseNameLength,
  normalizeExerciseName,
} from '../common/exercise-name.js';

export interface ExerciseCatalogEntry {
  name: string;
  normalizedName: string;
  muscleGroup: string | null;
}

/** Resolves to `<repo or image root>/config/exercises.json` from both src/ and dist/. */
export const DEFAULT_EXERCISE_CATALOG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../config/exercises.json',
);

const MAX_NAME_LENGTH = 120;
const MAX_MUSCLE_GROUP_LENGTH = 80;
const ENTRY_KEYS = new Set(['name', 'muscleGroup']);

/**
 * Validates catalog data shaped as `[{ "name": string, "muscleGroup"?: string | null }]`.
 * Names and muscle groups are outer-trimmed; normalized keys must be unique.
 */
export function parseExerciseCatalog(data: unknown): ExerciseCatalogEntry[] {
  if (!Array.isArray(data)) throw new Error('Exercise catalog must be a JSON array');

  const seen = new Set<string>();
  return data.map((raw: unknown, index) => {
    const at = `Exercise catalog entry ${index}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`${at} must be an object`);
    }
    const unknownKey = Object.keys(raw).find((key) => !ENTRY_KEYS.has(key));
    if (unknownKey) throw new Error(`${at} has unsupported key "${unknownKey}"`);

    const { name, muscleGroup = null } = raw as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`${at} name must be a non-blank string`);
    }
    if (Array.from(name).length > MAX_NAME_LENGTH) {
      throw new Error(`${at} name must be at most ${MAX_NAME_LENGTH} characters`);
    }
    const normalizedName = normalizeExerciseName(name);
    if (!hasValidNormalizedExerciseNameLength(normalizedName, MAX_NAME_LENGTH)) {
      throw new Error(`${at} name is too long after normalization`);
    }
    if (seen.has(normalizedName)) {
      throw new Error(`${at} duplicates normalized name "${normalizedName}"`);
    }
    seen.add(normalizedName);

    if (muscleGroup !== null) {
      if (typeof muscleGroup !== 'string' || !muscleGroup.trim()) {
        throw new Error(`${at} muscleGroup must be a non-blank string or null`);
      }
      if (Array.from(muscleGroup.trim()).length > MAX_MUSCLE_GROUP_LENGTH) {
        throw new Error(`${at} muscleGroup must be at most ${MAX_MUSCLE_GROUP_LENGTH} characters`);
      }
    }

    return {
      name: name.trim(),
      normalizedName,
      muscleGroup: muscleGroup === null ? null : muscleGroup.trim(),
    };
  });
}

export function loadExerciseCatalog(path = DEFAULT_EXERCISE_CATALOG_PATH): ExerciseCatalogEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read exercise catalog at ${path}: ${(error as Error).message}`);
  }
  return parseExerciseCatalog(data);
}
