import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from './entities/exercise.entity.js';
import { WorkoutEntry } from './entities/workout-entry.entity.js';
import { WorkoutSet } from './entities/workout-set.entity.js';
import { ExerciseSeedService } from './exercise-seed.service.js';
import { WorkoutsController } from './workouts.controller.js';
import { WorkoutsService } from './workouts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, WorkoutEntry, WorkoutSet])],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, ExerciseSeedService],
})
export class WorkoutsModule {}
