export function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase();
}

/** PostgreSQL varchar length is counted after Unicode case conversion. */
export function hasValidNormalizedExerciseNameLength(
  value: string,
  maxLength = 120,
): boolean {
  return Array.from(value).length > 0 && Array.from(value).length <= maxLength;
}

export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
