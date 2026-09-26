import { describe, expect, it, vi } from 'vitest';
import { UnitsService } from '../../units/units.service.js';
import { PersonalRecordsService } from '../personal-records.service.js';

// Each query gets a different row, as it would after ranking the same candidate
// sets by three different metrics in PostgreSQL. These mocks test mapping and
// independence; they do not replace a database test of the SQL winner selection.
const winners = {
  heaviestSet: {
    entry_id: 'entry-heavy',
    set_id: 'set-heavy',
    workout_date: '2026-08-15',
    reps: 1,
    weight_kg: '120.000000',
    metric_value: '120.000000',
  },
  highestVolume: {
    entry_id: 'entry-volume',
    set_id: 'set-volume',
    workout_date: '2026-08-16',
    reps: 10,
    weight_kg: '80.000000',
    metric_value: '800.000000',
  },
  estimatedOneRepMax: {
    entry_id: 'entry-epley',
    set_id: 'set-epley',
    workout_date: '2026-08-17',
    reps: 9,
    weight_kg: '100.000000',
    metric_value: '130.000000',
  },
} as const;

type Metric = keyof typeof winners;

function metricFor(sql: string): Metric {
  if (sql.includes('ORDER BY ws.weight_kg DESC')) return 'heaviestSet';
  if (sql.includes('ORDER BY (ws.reps::numeric * ws.weight_kg) DESC'))
    return 'highestVolume';
  if (
    sql.includes(
      'ORDER BY (ws.weight_kg * (1::numeric + ws.reps::numeric / 30::numeric)) DESC',
    )
  ) {
    return 'estimatedOneRepMax';
  }
  throw new Error(`Unexpected PR metric query: ${sql}`);
}

const expectedRecords = {
  heaviestSet: {
    entryId: 'entry-heavy',
    setId: 'set-heavy',
    reps: 1,
    weight: 120,
    unit: 'kg',
    value: 120,
    valueUnit: 'kg',
    achievedDate: '2026-08-15',
  },
  highestVolume: {
    entryId: 'entry-volume',
    setId: 'set-volume',
    reps: 10,
    weight: 80,
    unit: 'kg',
    value: 800,
    valueUnit: 'kg·reps',
    achievedDate: '2026-08-16',
  },
  estimatedOneRepMax: {
    entryId: 'entry-epley',
    setId: 'set-epley',
    reps: 9,
    weight: 100,
    unit: 'kg',
    value: 130,
    valueUnit: 'kg',
    achievedDate: '2026-08-17',
  },
};

const emptyRecords = {
  heaviestSet: null,
  highestVolume: null,
  estimatedOneRepMax: null,
};

describe('PersonalRecordsService', () => {
  it('maps three independent metric winners and returns null records for an unknown name', async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) =>
      params[1] === 'bench press' ? [winners[metricFor(sql)]] : [],
    );
    const service = new PersonalRecordsService(
      { query } as never,
      new UnitsService(),
    );

    expect(
      await service.get('demo-user-001', {
        exerciseName: '  Bench Press  ',
        unit: 'kg',
      }),
    ).toEqual(expectedRecords);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.map(([sql]) => metricFor(sql))).toEqual([
      'heaviestSet',
      'highestVolume',
      'estimatedOneRepMax',
    ]);
    expect(query.mock.calls[0][1]).toEqual(['demo-user-001', 'bench press']);
    expect(
      new Set(Object.values(expectedRecords).map((record) => record.setId))
        .size,
    ).toBe(3);

    expect(
      await service.get('demo-user-001', {
        exerciseName: 'Unknown Lift',
        unit: 'kg',
      }),
    ).toEqual({
      ...emptyRecords,
      message: 'No personal records found for the requested range',
    });
  });

  it('keeps comparison ranges independent: distinct winners in A, nulls and message only in B', async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) =>
      params[2] === '2026-08-01' ? [winners[metricFor(sql)]] : [],
    );
    const service = new PersonalRecordsService(
      { query } as never,
      new UnitsService(),
    );

    expect(
      await service.compare('demo-user-001', {
        exerciseName: 'Bench Press',
        unit: 'kg',
        rangeAFrom: '2026-08-01',
        rangeATo: '2026-08-31',
        rangeBFrom: '2026-09-01',
        rangeBTo: '2026-09-30',
      }),
    ).toEqual({
      rangeA: {
        from: '2026-08-01',
        to: '2026-08-31',
        records: expectedRecords,
      },
      rangeB: {
        from: '2026-09-01',
        to: '2026-09-30',
        records: emptyRecords,
        message: 'No personal records found for this range',
      },
    });
    expect(query).toHaveBeenCalledTimes(6);
    for (const metric of Object.keys(winners) as Metric[]) {
      const calls = query.mock.calls.filter(
        ([sql]) => metricFor(sql) === metric,
      );
      expect(calls.map(([, params]) => params)).toEqual([
        ['demo-user-001', 'bench press', '2026-08-01', '2026-08-31'],
        ['demo-user-001', 'bench press', '2026-09-01', '2026-09-30'],
      ]);
    }
  });

  it('rejects invalid date ranges and user IDs before querying', async () => {
    const query = vi.fn();
    const service = new PersonalRecordsService(
      { query } as never,
      new UnitsService(),
    );
    await expect(
      service.get('  ', { exerciseName: 'Bench Press', unit: 'kg' }),
    ).rejects.toThrow('userId must be 1-128 characters');
    await expect(
      service.get('demo-user-001', {
        exerciseName: 'Bench Press',
        from: '2026-09-30',
        to: '2026-09-01',
        unit: 'kg',
      }),
    ).rejects.toThrow('from must be earlier than or equal to to');
    expect(query).not.toHaveBeenCalled();
  });
});
