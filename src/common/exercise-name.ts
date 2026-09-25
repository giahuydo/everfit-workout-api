export function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase();
}

export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
