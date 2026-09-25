import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { HistoryQueryDto } from '../src/workouts/dto/history-query.dto.js';
import { LogWorkoutDto } from '../src/workouts/dto/log-workout.dto.js';
import { ComparePrQueryDto, PrQueryDto } from '../src/workouts/dto/pr-query.dto.js';
import { PersonalRecordsService } from '../src/personal-records/personal-records.service.js';
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
