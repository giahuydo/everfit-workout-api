import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Decimal } from 'decimal.js';
import { assertRange } from '../common/date.js';
import { normalizeExerciseName } from '../common/exercise-name.js';
import { UnitsService, type WeightUnit } from '../units/units.service.js';
import { ComparePrQueryDto, PrQueryDto } from '../workouts/dto/pr-query.dto.js';

type Metric = 'heaviestSet' | 'highestVolume' | 'estimatedOneRepMax';

interface WinnerRow {
  set_id: string;
  entry_id: string;
  workout_date: string;
  created_at: Date;
  set_order: number;
  reps: number;
  weight_kg: string;
  metric_value: string;
}

@Injectable()
export class PersonalRecordsService {
  constructor(private readonly dataSource: DataSource, private readonly units: UnitsService) {}

  async get(userId: string, query: PrQueryDto) {
    this.assertUserId(userId);
    assertRange(query.from, query.to);
    const unit = query.unit ?? 'kg';
    this.units.assertUnit(unit);
    const result = await this.compute(userId, query.exerciseName, query.from, query.to, unit);
    return result.message ? { ...result.records, message: result.message } : result.records;
  }

  async compare(userId: string, query: ComparePrQueryDto) {
    this.assertUserId(userId);
    assertRange(query.rangeAFrom, query.rangeATo);
    assertRange(query.rangeBFrom, query.rangeBTo);
    const unit = query.unit ?? 'kg';
    this.units.assertUnit(unit);
    const [a, b] = await Promise.all([
      this.compute(userId, query.exerciseName, query.rangeAFrom, query.rangeATo, unit),
      this.compute(userId, query.exerciseName, query.rangeBFrom, query.rangeBTo, unit),
    ]);

    return {
      rangeA: a.message
        ? { from: query.rangeAFrom, to: query.rangeATo, records: a.records, message: 'No personal records found for this range' }
        : { from: query.rangeAFrom, to: query.rangeATo, records: a.records },
      rangeB: b.message
        ? { from: query.rangeBFrom, to: query.rangeBTo, records: b.records, message: 'No personal records found for this range' }
        : { from: query.rangeBFrom, to: query.rangeBTo, records: b.records },
    };
  }

  private async compute(userId: string, exerciseName: string, from: string | undefined, to: string | undefined, unit: WeightUnit) {
    const normalized = normalizeExerciseName(exerciseName);
    const baseParams: unknown[] = [userId, normalized];
    const conditions = ['we.user_id = $1', 'e.normalized_name = $2'];
    if (from) { baseParams.push(from); conditions.push(`we.workout_date >= $${baseParams.length}`); }
    if (to) { baseParams.push(to); conditions.push(`we.workout_date <= $${baseParams.length}`); }
    const where = conditions.join(' AND ');
    const shared = `FROM workout_sets ws JOIN workout_entries we ON we.id = ws.workout_entry_id JOIN exercises e ON e.id = we.exercise_id WHERE ${where}`;
    const tie = `we.workout_date ASC, we.created_at ASC, we.id ASC, ws.set_order ASC, ws.id ASC`;

    const specs: Record<Metric, { expr: string; order: string }> = {
      heaviestSet: { expr: 'ws.weight_kg', order: `ws.weight_kg DESC, ${tie}` },
      highestVolume: { expr: '(ws.reps::numeric * ws.weight_kg)', order: `(ws.reps::numeric * ws.weight_kg) DESC, ${tie}` },
      estimatedOneRepMax: { expr: `(ws.weight_kg * (1::numeric + ws.reps::numeric / 30::numeric))`, order: `(ws.weight_kg * (1::numeric + ws.reps::numeric / 30::numeric)) DESC, ${tie}` },
    };

    const entries = await Promise.all((Object.keys(specs) as Metric[]).map(async (metric) => {
      const spec = specs[metric];
      const rows = await this.dataSource.query(
        `SELECT ws.id AS set_id, we.id AS entry_id, to_char(we.workout_date, 'YYYY-MM-DD') AS workout_date, we.created_at, ws.set_order, ws.reps, ws.weight_kg, ${spec.expr} AS metric_value ${shared} ORDER BY ${spec.order} LIMIT 1`,
        baseParams,
      ) as WinnerRow[];
      return [metric, rows[0] ? this.mapWinner(metric, rows[0], unit) : null] as const;
    }));

    const records = Object.fromEntries(entries) as Record<Metric, ReturnType<PersonalRecordsService['mapWinner']> | null>;
    const empty = Object.values(records).every((value) => value === null);
    return {
      records,
      message: empty ? 'No personal records found for the requested range' : null,
    };
  }

  private mapWinner(metric: Metric, row: WinnerRow, unit: WeightUnit) {
    const weight = this.units.fromKg(row.weight_kg, unit);
    const value = metric === 'highestVolume'
      // Multiply exact canonical kg first; convert and round the total once.
      ? this.units.volumeFromKg(new Decimal(row.weight_kg).times(row.reps).toFixed(), unit)
      : this.units.fromKg(row.metric_value, unit);
    return {
      entryId: row.entry_id,
      setId: row.set_id,
      reps: row.reps,
      weight,
      unit,
      value,
      valueUnit: metric === 'highestVolume' ? `${unit}·reps` : unit,
      achievedDate: row.workout_date,
    };
  }

  private assertUserId(userId: string) {
    if (!userId?.trim() || userId.length > 128) throw new BadRequestException('userId must be 1-128 characters');
  }
}
