import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, In, Repository } from 'typeorm';
import { assertCalendarDate, assertRange } from '../common/date.js';
import {
  escapeLike,
  hasValidNormalizedExerciseNameLength,
  normalizeExerciseName,
} from '../common/exercise-name.js';
import { UnitsService, type WeightUnit } from '../units/units.service.js';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import { LogWorkoutDto } from './dto/log-workout.dto.js';
import { Exercise } from './entities/exercise.entity.js';
import { WorkoutEntry } from './entities/workout-entry.entity.js';
import { WorkoutSet } from './entities/workout-set.entity.js';

interface CursorPayload {
  v: 1;
  date: string;
  createdAt: string;
  id: string;
  scope: string;
}

interface HistoryRow extends WorkoutEntry {
  cursorCreatedAt: string;
}

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(WorkoutEntry)
    private readonly entryRepo: Repository<WorkoutEntry>,
    @InjectRepository(WorkoutSet)
    private readonly setRepo: Repository<WorkoutSet>,
    private readonly units: UnitsService,
  ) {}

  async log(userId: string, dto: LogWorkoutDto) {
    this.assertUserId(userId);
    assertCalendarDate(dto.date);

    return this.dataSource.transaction(async (manager) => {
      const namesByNormalized = new Map<string, string>();
      for (const exerciseInput of dto.exercises) {
        const displayName = exerciseInput.exerciseName.trim();
        if (!displayName)
          throw new BadRequestException('exerciseName cannot be blank');
        const normalized = normalizeExerciseName(displayName);
        if (!hasValidNormalizedExerciseNameLength(normalized)) {
          throw new BadRequestException(
            'exerciseName is too long after normalization',
          );
        }
        // The first spelling in a request becomes the display name if this is
        // the first time the shared catalog has seen the normalized key.
        if (!namesByNormalized.has(normalized))
          namesByNormalized.set(normalized, displayName);
      }

      // Every transaction locks/conflicts on catalog names in the same order,
      // avoiding opposite-order waits for bulk requests with overlapping names.
      const resolved = new Map<string, Exercise>();
      for (const [normalized, displayName] of [
        ...namesByNormalized.entries(),
      ].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
        const id = randomUUID();
        const inserted = await manager.query(
          `INSERT INTO exercises (id, name, normalized_name, muscle_group, created_at, updated_at)
           VALUES ($1, $2, $3, NULL, now(), now())
           ON CONFLICT (normalized_name) DO NOTHING
           RETURNING id, name, normalized_name AS "normalizedName", muscle_group AS "muscleGroup", created_at AS "createdAt", updated_at AS "updatedAt"`,
          [id, displayName, normalized],
        );
        const exercise = inserted[0]
          ? Object.assign(new Exercise(), inserted[0])
          : await manager
              .getRepository(Exercise)
              .findOne({ where: { normalizedName: normalized } });
        if (!exercise)
          throw new BadRequestException('Could not resolve exercise');
        resolved.set(normalized, exercise);
      }

      const entries: WorkoutEntry[] = [];

      for (const exerciseInput of dto.exercises) {
        const displayName = exerciseInput.exerciseName.trim();
        const normalized = normalizeExerciseName(displayName);
        const exercise = resolved.get(normalized);
        if (!exercise)
          throw new BadRequestException('Could not resolve exercise');

        const entry = manager.getRepository(WorkoutEntry).create({
          userId,
          exerciseId: exercise.id,
          workoutDate: dto.date,
        });
        const savedEntry = await manager
          .getRepository(WorkoutEntry)
          .save(entry);

        const setEntities = exerciseInput.sets.map((set, index) => {
          const weightKg = this.units.toKg(set.weight, set.unit);
          return manager.getRepository(WorkoutSet).create({
            workoutEntryId: savedEntry.id,
            setOrder: index + 1,
            reps: set.reps,
            originalWeight: Number(set.weight).toFixed(3),
            originalUnit: set.unit,
            weightKg,
          });
        });
        const savedSets = await manager
          .getRepository(WorkoutSet)
          .save(setEntities);
        savedEntry.exercise = exercise;
        savedEntry.sets = savedSets;
        entries.push(savedEntry);
      }

      return {
        entries: entries.map((entry) =>
          this.logEntryResponse(entry, entry.sets),
        ),
      };
    });
  }

  async history(userId: string, query: HistoryQueryDto) {
    this.assertUserId(userId);
    assertRange(query.from, query.to);
    const unit = query.unit ?? 'kg';
    this.units.assertUnit(unit);
    const limit = query.limit ?? 20;
    const scope = this.cursorScope(userId, query, unit, limit);

    const qb = this.entryRepo
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.exercise', 'exercise')
      .where('entry.user_id = :userId', { userId });

    if (query.from)
      qb.andWhere('entry.workout_date >= :from', { from: query.from });
    if (query.to) qb.andWhere('entry.workout_date <= :to', { to: query.to });
    if (query.exerciseName?.trim()) {
      const term = escapeLike(normalizeExerciseName(query.exerciseName));
      qb.andWhere(`exercise.normalized_name LIKE :term ESCAPE '\\'`, {
        term: `%${term}%`,
      });
    }
    if (query.muscleGroup?.trim()) {
      qb.andWhere('LOWER(exercise.muscle_group) = :muscleGroup', {
        muscleGroup: query.muscleGroup.trim().toLowerCase(),
      });
    }

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor, scope);
      qb.andWhere(
        `(entry.workout_date < :cDate OR
          (entry.workout_date = :cDate AND entry.created_at < CAST(:cCreatedAt AS timestamptz)) OR
          (entry.workout_date = :cDate AND entry.created_at = CAST(:cCreatedAt AS timestamptz) AND entry.id < :cId))`,
        { cDate: cursor.date, cCreatedAt: cursor.createdAt, cId: cursor.id },
      );
    }

    const { entities, raw } = await qb
      .orderBy('entry.workout_date', 'DESC')
      .addOrderBy('entry.created_at', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      // TypeORM hydrates TIMESTAMPTZ into a JS Date, which only has milliseconds.
      // Select the canonical cursor key separately so its six digits survive paging.
      .addSelect(
        `to_char(entry.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        'cursor_created_at',
      )
      .take(limit + 1)
      .getRawAndEntities();

    const rows = entities.map((entry, index) =>
      Object.assign(entry, {
        cursorCreatedAt: raw[index]?.cursor_created_at as string,
      }),
    ) as HistoryRow[];

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((row) => row.id);
    const sets = ids.length
      ? await this.setRepo.find({
          where: { workoutEntryId: In(ids) },
          order: { workoutEntryId: 'ASC', setOrder: 'ASC' },
        })
      : [];
    const setsByEntry = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const bucket = setsByEntry.get(set.workoutEntryId) ?? [];
      bucket.push(set);
      setsByEntry.set(set.workoutEntryId, bucket);
    }

    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? this.encodeCursor({
            v: 1,
            date: last.workoutDate,
            createdAt: last.cursorCreatedAt,
            id: last.id,
            scope,
          })
        : null;

    const response = {
      items: page.map((entry) =>
        this.entryResponse(entry, setsByEntry.get(entry.id) ?? [], unit, true),
      ),
      page: { limit, hasMore, nextCursor },
    };
    return page.length === 0
      ? { ...response, message: 'No workouts found for the requested filters' }
      : response;
  }

  private logEntryResponse(entry: WorkoutEntry, sets: WorkoutSet[]) {
    return {
      id: entry.id,
      exerciseName: entry.exercise?.name,
      date: entry.workoutDate,
      sets: [...sets].sort((a, b) => a.setOrder - b.setOrder).map((set) => ({
        id: set.id,
        reps: set.reps,
        weight: Number(set.originalWeight),
        unit: set.originalUnit,
      })),
    };
  }

  private entryResponse(
    entry: HistoryRow,
    sets: WorkoutSet[],
    unit: WeightUnit,
    convert: boolean,
  ) {
    return {
      id: entry.id,
      exerciseName: entry.exercise?.name,
      muscleGroup: entry.exercise?.muscleGroup ?? null,
      date: entry.workoutDate,
      createdAt: entry.cursorCreatedAt,
      sets: [...sets]
        .sort((a, b) => a.setOrder - b.setOrder)
        .map((set) => ({
          id: set.id,
          reps: set.reps,
          weight: convert
            ? this.units.fromKg(set.weightKg, unit)
            : Number(set.originalWeight),
          unit: convert ? unit : set.originalUnit,
        })),
    };
  }

  private assertUserId(userId: string) {
    if (!userId?.trim() || userId.length > 128)
      throw new BadRequestException('userId must be 1-128 characters');
  }

  private cursorScope(
    userId: string,
    query: HistoryQueryDto,
    unit: WeightUnit,
    limit: number,
  ): string {
    const canonical = JSON.stringify({
      userId,
      exerciseName: query.exerciseName?.trim()
        ? normalizeExerciseName(query.exerciseName)
        : null,
      muscleGroup: query.muscleGroup?.trim().toLowerCase() ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
      unit,
      limit,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(raw: string, expectedScope: string): CursorPayload {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('invalid encoding');
      const parsed = JSON.parse(
        Buffer.from(raw, 'base64url').toString('utf8'),
      ) as CursorPayload;
      if (
        parsed.v !== 1 ||
        typeof parsed.date !== 'string' ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.id !== 'string' ||
        parsed.scope !== expectedScope
      )
        throw new Error('invalid');
      assertCalendarDate(parsed.date, 'cursor.date');
      if (
        !this.isUtcMicrosecondTimestamp(parsed.createdAt) ||
        !this.isUuid(parsed.id)
      )
        throw new Error('invalid cursor key');
      return parsed;
    } catch {
      throw new BadRequestException('Invalid cursor for the current query');
    }
  }

  private isUtcMicrosecondTimestamp(value: string): boolean {
    const match =
      /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/.exec(
        value,
      );
    if (!match) return false;
    assertCalendarDate(match[1], 'cursor.createdAt');
    const [, , hour, minute, second] = match;
    return Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
