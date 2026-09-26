import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { HistoryQueryDto } from '../src/workouts/dto/history-query.dto.js';
import { LogWorkoutDto } from '../src/workouts/dto/log-workout.dto.js';
import { ComparePrQueryDto, PrQueryDto } from '../src/personal-records/dto/pr-query.dto.js';
import { PersonalRecordsService } from '../src/personal-records/personal-records.service.js';
import { assertCalendarDate } from '../src/common/date.js';
import { UnitsService, WEIGHT_UNITS } from '../src/units/units.service.js';
import { WorkoutsService } from '../src/workouts/workouts.service.js';

describe('API contract validation', () => {
  it.each([
    ['PrQueryDto', PrQueryDto, { exerciseName: 'Bench Press' }],
    ['ComparePrQueryDto', ComparePrQueryDto, {
      exerciseName: 'Bench Press',
      rangeAFrom: '2026-01-01',
      rangeATo: '2026-01-31',
      rangeBFrom: '2026-02-01',
      rangeBTo: '2026-02-28',
    }],
    ['HistoryQueryDto', HistoryQueryDto, {}],
  ] as const)('%s accepts exactly the shared WEIGHT_UNITS registry', async (_name, Dto, base) => {
    for (const unit of WEIGHT_UNITS) {
      expect(await validate(plainToInstance(Dto as any, { ...base, unit }))).toHaveLength(0);
    }
    const errors = await validate(plainToInstance(Dto as any, { ...base, unit: 'stone' }));
    expect(errors.map((error) => error.property)).toEqual(['unit']);
  });


  it('rejects PostgreSQL-incompatible year zero at the API date boundary', () => {
    expect(() => assertCalendarDate('0000-01-01')).toThrow('date is not a valid calendar date');
    expect(assertCalendarDate('0001-01-01')).toBe('0001-01-01');
  });

  it('treats blank muscle-group spelling as the same effective cursor scope as omission', () => {
    const service = new WorkoutsService({} as never, {} as never, {} as never, {} as never, {} as never);
    const scope = (query: HistoryQueryDto) => (service as any).cursorScope('scope-user', query, 'kg', 20);

    expect(scope(plainToInstance(HistoryQueryDto, {})))
      .toBe(scope(plainToInstance(HistoryQueryDto, { muscleGroup: '   ' })));
  });

  it('rejects numeric strings in workout request bodies', async () => {
    const dto = plainToInstance(LogWorkoutDto, {
      date: '2026-09-25',
      exercises: [{
        exerciseName: 'Bench Press',
        sets: [{ reps: '5', weight: '100', unit: 'kg' }],
      }],
    });

    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('only accepts exact, UTC microsecond cursor keys before querying', () => {
    const service = new WorkoutsService({} as never, {} as never, {} as never, {} as never, {} as never);
    const decode = (value: object) => (service as any).decodeCursor(
      Buffer.from(JSON.stringify(value)).toString('base64url'),
      'scope',
    );
    const valid = {
      v: 1,
      date: '2026-09-25',
      createdAt: '2026-09-25T12:30:00.123456Z',
      id: '550e8400-e29b-41d4-a716-446655440000',
      scope: 'scope',
    };

    expect(decode(valid)).toEqual(valid);
    expect(() => decode({ ...valid, createdAt: '2026-09-25T12:30:00.123Z' })).toThrow('Invalid cursor');
    expect(() => decode({ ...valid, id: 'not-a-uuid' })).toThrow('Invalid cursor');
  });

  it('accepts any PostgreSQL uuid as a cursor id, including non-RFC md5(...)::uuid keys', () => {
    const service = new WorkoutsService({} as never, {} as never, {} as never, {} as never, {} as never);
    const decode = (value: object) => (service as any).decodeCursor(
      Buffer.from(JSON.stringify(value)).toString('base64url'),
      'scope',
    );
    // SELECT md5('everfit-perf-entry-1')::uuid — version nibble and variant are arbitrary.
    const md5Id = createHash('md5').update('everfit-perf-entry-1').digest('hex')
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    const base = { v: 1, date: '2026-09-25', createdAt: '2026-09-25T12:30:00.123456Z', scope: 'scope' };

    for (const id of [md5Id, '00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-cfff-3fff-ffffffffffff', 'ABCDEF01-2345-6789-ABCD-EF0123456789']) {
      expect(decode({ ...base, id })).toEqual({ ...base, id });
    }
    for (const id of ['', 'not-a-uuid', '550e8400e29b41d4a716446655440000', '{550e8400-e29b-41d4-a716-446655440000}', '550e8400-e29b-41d4-a716-44665544000g', '550e8400-e29b-41d4-a716-4466554400000', "550e8400-e29b-41d4-a716-446655440000' OR 1=1"]) {
      expect(() => decode({ ...base, id })).toThrow('Invalid cursor');
    }
  });

  it('computes highestVolume from exact canonical kg x reps, converting and rounding once', () => {
    const service = new PersonalRecordsService({} as never, new UnitsService());
    const winner = {
      entry_id: 'entry-uuid',
      set_id: 'set-uuid',
      reps: 10,
      weight_kg: '40.000111',
      metric_value: '400.001110',
      workout_date: '2026-09-25',
    };
    // 400.00111 kg / 0.45359237 = 881.85149587... lb·reps -> 881.851.
    // Rounding the converted weight first (88.185150 lb x 10 = 881.8515) would give 881.852.
    expect((service as any).mapWinner('highestVolume', winner, 'lb')).toEqual(expect.objectContaining({
      weight: 88.185,
      unit: 'lb',
      value: 881.851,
      valueUnit: 'lb·reps',
    }));
    expect((service as any).mapWinner('highestVolume', winner, 'kg').value).toBe(400.001);
  });

  it('maps personal-record winners to the documented public fields', () => {
    const service = new PersonalRecordsService({} as never, new UnitsService());
    expect((service as any).mapWinner('heaviestSet', {
      entry_id: 'entry-uuid',
      set_id: 'set-uuid',
      reps: 5,
      weight_kg: '100.000000',
      metric_value: '100.000000',
      workout_date: '2026-09-25',
    }, 'kg')).toEqual({
      entryId: 'entry-uuid',
      setId: 'set-uuid',
      reps: 5,
      weight: 100,
      unit: 'kg',
      value: 100,
      valueUnit: 'kg',
      achievedDate: '2026-09-25',
    });
  });
});
