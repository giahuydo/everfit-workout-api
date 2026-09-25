import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeExerciseName } from '../common/exercise-name.js';
import { EXERCISE_CATALOG } from './config/exercise-catalog.js';
import { Exercise } from './entities/exercise.entity.js';

@Injectable()
export class ExerciseSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Exercise) private readonly repo: Repository<Exercise>,
  ) {}

  async onModuleInit() {
    const seed = EXERCISE_CATALOG.map(({ name, muscleGroup }) => ({
      name,
      muscleGroup,
      normalizedName: normalizeExerciseName(name),
    })).sort((left, right) =>
      left.normalizedName < right.normalizedName
        ? -1
        : left.normalizedName > right.normalizedName
          ? 1
          : 0,
    );

    for (const { name, muscleGroup, normalizedName } of seed) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(Exercise)
        .values({ name, normalizedName, muscleGroup })
        .orIgnore()
        .execute();
    }
  }
}
