// Documentation-only personal-record schemas and examples; no service dependencies.
import type { SchemaObject } from '@nestjs/swagger';

const setId = '601c48e5-ddf6-43a1-8a69-5a5a8cc2dbba';
const secondSetId = 'de8ca036-d199-4f91-9daa-5e945c35668c';
const entryId = 'f208022b-cd3b-4e0c-8f7b-e2457d565fc5';
const septemberEntryId = 'a030abf1-415b-4d6c-8c84-5f82766580ae';
const septemberLbSetId = '60217f85-e157-4c1a-8529-098c4327db68';
const septemberKgSetId = '13d64378-2ee0-4383-a1b9-9555b0d956fa';

const recordSchema = {
  type: 'object',
  required: [
    'entryId',
    'setId',
    'reps',
    'weight',
    'unit',
    'value',
    'valueUnit',
    'achievedDate',
  ],
  properties: {
    entryId: { type: 'string', format: 'uuid' },
    setId: { type: 'string', format: 'uuid' },
    reps: { type: 'integer' },
    weight: { type: 'number' },
    unit: { type: 'string', enum: ['kg', 'lb'] },
    value: { type: 'number' },
    valueUnit: { type: 'string', example: 'kg·reps' },
    achievedDate: { type: 'string', format: 'date' },
  },
} satisfies SchemaObject;

export const prRecordsSchema = {
  type: 'object',
  required: ['heaviestSet', 'highestVolume', 'estimatedOneRepMax'],
  properties: {
    heaviestSet: { ...recordSchema, nullable: true },
    highestVolume: { ...recordSchema, nullable: true },
    estimatedOneRepMax: { ...recordSchema, nullable: true },
  },
} satisfies SchemaObject;

export const prResponseSchema = {
  ...prRecordsSchema,
  properties: {
    ...prRecordsSchema.properties,
    message: {
      type: 'string',
      description: 'Present only when no records match',
    },
  },
} satisfies SchemaObject;

export const prExample = {
  heaviestSet: {
    entryId,
    setId,
    reps: 5,
    weight: 100,
    unit: 'kg',
    value: 100,
    valueUnit: 'kg',
    achievedDate: '2026-08-15',
  },
  highestVolume: {
    entryId,
    setId: secondSetId,
    reps: 8,
    weight: 90,
    unit: 'kg',
    value: 720,
    valueUnit: 'kg·reps',
    achievedDate: '2026-08-15',
  },
  estimatedOneRepMax: {
    entryId,
    setId,
    reps: 5,
    weight: 100,
    unit: 'kg',
    value: 116.667,
    valueUnit: 'kg',
    achievedDate: '2026-08-15',
  },
};

const rangeSchema = {
  type: 'object',
  required: ['from', 'to', 'records'],
  properties: {
    from: { type: 'string', format: 'date' },
    to: { type: 'string', format: 'date' },
    records: prRecordsSchema,
    message: {
      type: 'string',
      description: 'Present only when this range has no records',
    },
  },
} satisfies SchemaObject;

export const compareResponseSchema = {
  type: 'object',
  required: ['rangeA', 'rangeB'],
  properties: { rangeA: rangeSchema, rangeB: rangeSchema },
} satisfies SchemaObject;

export const septemberPrExample = {
  heaviestSet: {
    entryId: septemberEntryId,
    setId: septemberLbSetId,
    reps: 5,
    weight: 110,
    unit: 'kg',
    value: 110,
    valueUnit: 'kg',
    achievedDate: '2026-09-15',
  },
  highestVolume: {
    entryId: septemberEntryId,
    setId: septemberKgSetId,
    reps: 8,
    weight: 100,
    unit: 'kg',
    value: 800,
    valueUnit: 'kg·reps',
    achievedDate: '2026-09-15',
  },
  estimatedOneRepMax: {
    entryId: septemberEntryId,
    setId: septemberLbSetId,
    reps: 5,
    weight: 110,
    unit: 'kg',
    value: 128.333,
    valueUnit: 'kg',
    achievedDate: '2026-09-15',
  },
};

export const emptyPrExample = {
  heaviestSet: null,
  highestVolume: null,
  estimatedOneRepMax: null,
};

export const emptyPrResponseExample = {
  ...emptyPrExample,
  message: 'No personal records found for the requested range',
};

export const compareExample = {
  rangeA: { from: '2026-09-01', to: '2026-09-30', records: septemberPrExample },
  rangeB: { from: '2026-08-01', to: '2026-08-31', records: prExample },
};

export const compareNoDataExample = {
  rangeA: compareExample.rangeA,
  rangeB: {
    from: '2026-07-01',
    to: '2026-07-31',
    records: emptyPrExample,
    message: 'No personal records found for this range',
  },
};
