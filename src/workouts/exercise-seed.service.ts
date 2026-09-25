import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercise } from './entities/exercise.entity.js';
import { loadExerciseCatalog } from './exercise-catalog.js';

/**
 * Seeds the shared catalog from JSON data (default `config/exercises.json`,
 * overridable with EXERCISE_CATALOG_PATH). Inserts missing rows only: editing
 * the file never overwrites a catalog value that is already stored.
 */
@Injectable()
export class ExerciseSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Exercise) private readonly repo: Repository<Exercise>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const seed = loadExerciseCatalog(
      this.config.get<string>('EXERCISE_CATALOG_PATH'),
    ).sort((left, right) =>
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
