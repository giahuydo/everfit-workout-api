/**
 * Curated global exercise metadata. The seed process inserts missing rows only:
 * changing this list never overwrites a catalog value that is already stored.
 */
export const EXERCISE_CATALOG = [
  { name: 'Back Squat', muscleGroup: 'legs' },
  { name: 'Bench Press', muscleGroup: 'chest' },
  { name: 'Deadlift', muscleGroup: 'back' },
  { name: 'Overhead Press', muscleGroup: 'shoulders' },
  { name: 'Pull Up', muscleGroup: 'back' },
] as const;
