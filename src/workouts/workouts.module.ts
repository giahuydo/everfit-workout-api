import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalRecordsController } from '../personal-records/personal-records.controller.js';
import { PersonalRecordsService } from '../personal-records/personal-records.service.js';
import { Exercise } from './entities/exercise.entity.js';
import { WorkoutEntry } from './entities/workout-entry.entity.js';
import { WorkoutSet } from './entities/workout-set.entity.js';
import { ExerciseSeedService } from './exercise-seed.service.js';
import { WorkoutsController } from './workouts.controller.js';
import { WorkoutsService } from './workouts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, WorkoutEntry, WorkoutSet])],
  controllers: [WorkoutsController, PersonalRecordsController],
  providers: [WorkoutsService, PersonalRecordsService, ExerciseSeedService],
})
export class WorkoutsModule {}
