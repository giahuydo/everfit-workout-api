import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import { LogWorkoutDto } from './dto/log-workout.dto.js';
import { WorkoutsService } from './workouts.service.js';

@ApiTags('workouts')
@Controller('v1/users/:userId/workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Log one or more exercises atomically' })
  log(@Param('userId') userId: string, @Body() body: LogWorkoutDto) {
    return this.workouts.log(userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Query workout history with cursor pagination' })
  history(@Param('userId') userId: string, @Query() query: HistoryQueryDto) {
    return this.workouts.history(userId, query);
  }
}
