import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import {
  ExerciseLogInputDto,
  LogWorkoutDto,
  WorkoutSetInputDto,
} from './dto/log-workout.dto.js';
import { ApiLogWorkout, ApiWorkoutHistory } from './workouts.openapi.js';
import { WorkoutsService } from './workouts.service.js';

@ApiTags('workouts')
@ApiExtraModels(LogWorkoutDto, ExerciseLogInputDto, WorkoutSetInputDto)
@Controller('v1/users/:userId/workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post()
  @HttpCode(201)
  @ApiLogWorkout()
  log(@Param('userId') userId: string, @Body() body: LogWorkoutDto) {
    return this.workouts.log(userId, body);
  }

  @Get()
  @ApiWorkoutHistory()
  history(@Param('userId') userId: string, @Query() query: HistoryQueryDto) {
    return this.workouts.history(userId, query);
  }
}
