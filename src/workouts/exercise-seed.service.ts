import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeExerciseName } from '../common/exercise-name.js';
import { Exercise } from './entities/exercise.entity.js';

@Injectable()
export class ExerciseSeedService implements OnModuleInit {
  constructor(@InjectRepository(Exercise) private readonly repo: Repository<Exercise>) {}

  async onModuleInit() {
    const seed = [
      ['Bench Press', 'chest'],
      ['Back Squat', 'legs'],
      ['Deadlift', 'back'],
      ['Pull Up', 'back'],
      ['Overhead Press', 'shoulders'],
    ] as const;
    for (const [name, muscleGroup] of seed) {
      await this.repo.createQueryBuilder()
        .insert()
        .into(Exercise)
        .values({ name, normalizedName: normalizeExerciseName(name), muscleGroup })
        .orIgnore()
        .execute();
    }
  }
}
