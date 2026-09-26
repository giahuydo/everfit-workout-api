// Documentation-only workout schemas and examples; runtime response construction stays in services.
import type { SchemaObject } from '@nestjs/swagger';

const setId = '601c48e5-ddf6-43a1-8a69-5a5a8cc2dbba';
const secondSetId = 'de8ca036-d199-4f91-9daa-5e945c35668c';
const entryId = 'f208022b-cd3b-4e0c-8f7b-e2457d565fc5';
const septemberEntryId = 'a030abf1-415b-4d6c-8c84-5f82766580ae';
const septemberLbSetId = '60217f85-e157-4c1a-8529-098c4327db68';
const septemberKgSetId = '13d64378-2ee0-4383-a1b9-9555b0d956fa';

// Documentation-only presets: invalid examples are deliberately selectable even
// though they do not satisfy the request schema. Derive each from a fresh valid
// baseline so no example can mutate the payload used by another example.
const baselineRequest = (date: string) => ({
  date,
  exercises: [
    {
      exerciseName: 'Bench Press',
      sets: [{ reps: 5, weight: 100, unit: 'kg' }],
    },
  ],
});

const withFirstExerciseSets = (date: string, sets: object[]) => ({
  ...baselineRequest(date),
  exercises: [{ exerciseName: 'Bench Press', sets }],
});

export const workoutRequestExamples = {
  augustBaseline: {
    summary: 'August baseline',
    value: withFirstExerciseSets('2026-08-15', [
      { reps: 5, weight: 100, unit: 'kg' },
      { reps: 8, weight: 90, unit: 'kg' },
    ]),
  },
  septemberProgressMixedUnits: {
    summary: 'September progress — bulk + mixed kg/lb',
    value: {
      date: '2026-09-15',
      exercises: [
        {
          exerciseName: 'Bench Press',
          sets: [
            { reps: 5, weight: 242.508, unit: 'lb' },
            { reps: 8, weight: 100, unit: 'kg' },
          ],
        },
        {
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 120, unit: 'kg' }],
        },
      ],
    },
  },
  invalidUnsupportedUnit: {
    summary: 'Invalid — unsupported unit (400)',
    value: withFirstExerciseSets('2026-09-20', [
      { reps: 5, weight: 105, unit: 'stone' },
    ]),
  },
  invalidNegativeValues: {
    summary: 'Invalid — negative reps and weight (400)',
    value: withFirstExerciseSets('2026-09-20', [
      { reps: -5, weight: -100, unit: 'kg' },
    ]),
  },
  invalidEmptySets: {
    summary: 'Invalid — empty sets (400)',
    value: withFirstExerciseSets('2026-09-20', []),
  },
  invalidMalformedDate: {
    summary: 'Invalid — malformed date (400)',
    value: baselineRequest('20-09-2026'),
  },
};

const setSchema = {
  type: 'object',
  required: ['id', 'reps', 'weight', 'unit'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    reps: { type: 'integer', example: 5 },
    weight: { type: 'number', example: 100 },
    unit: { type: 'string', enum: ['kg', 'lb'] },
  },
} satisfies SchemaObject;

const entrySchema = {
  type: 'object',
  required: ['id', 'exerciseName', 'date', 'sets'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    exerciseName: { type: 'string', example: 'Bench Press' },
    date: { type: 'string', format: 'date' },
    sets: { type: 'array', items: setSchema },
  },
} satisfies SchemaObject;

export const logResponseSchema = {
  type: 'object',
  required: ['entries'],
  properties: { entries: { type: 'array', items: entrySchema } },
} satisfies SchemaObject;

export const augustLogResponse = {
  entries: [
    {
      id: entryId,
      exerciseName: 'Bench Press',
      date: '2026-08-15',
      sets: [
        { id: setId, reps: 5, weight: 100, unit: 'kg' },
        {
          id: secondSetId,
          reps: 8,
          weight: 90,
          unit: 'kg',
        },
      ],
    },
  ],
};

export const historyResponseSchema = {
  type: 'object',
  required: ['items', 'page'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'exerciseName',
          'muscleGroup',
          'date',
          'createdAt',
          'sets',
        ],
        properties: {
          ...entrySchema.properties,
          muscleGroup: { type: 'string', nullable: true, example: 'chest' },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-08-15T12:00:00.123456Z',
          },
        },
      },
    },
    page: {
      type: 'object',
      required: ['limit', 'hasMore', 'nextCursor'],
      properties: {
        limit: { type: 'integer', example: 20 },
        hasMore: { type: 'boolean', example: false },
        nextCursor: {
          type: 'string',
          nullable: true,
          description: 'Opaque cursor or null on the last page',
        },
      },
    },
    message: {
      type: 'string',
      description: 'Present only if no workouts match',
    },
  },
} satisfies SchemaObject;

// Illustrative IDs/timestamps only: the GET examples reflect the two valid
// POST presets, not a promise of particular database-generated identifiers.
export const historyExample = {
  items: [
    {
      id: septemberEntryId,
      exerciseName: 'Bench Press',
      muscleGroup: 'chest',
      date: '2026-09-15',
      createdAt: '2026-09-15T12:00:00.123456Z',
      sets: [
        { id: septemberLbSetId, reps: 5, weight: 110, unit: 'kg' },
        { id: septemberKgSetId, reps: 8, weight: 100, unit: 'kg' },
      ],
    },
    {
      ...augustLogResponse.entries[0],
      muscleGroup: 'chest',
      createdAt: '2026-08-15T12:00:00.123456Z',
    },
  ],
  page: { limit: 20, hasMore: false, nextCursor: null },
};

export const emptyHistoryExample = {
  items: [],
  page: { limit: 20, hasMore: false, nextCursor: null },
  message: 'No workouts found for the requested filters',
};
