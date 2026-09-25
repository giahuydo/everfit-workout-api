import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ComparePrQueryDto, PrQueryDto } from '../workouts/dto/pr-query.dto.js';
import { PersonalRecordsService } from './personal-records.service.js';

@ApiTags('personal-records')
@Controller('v1/users/:userId/personal-records')
export class PersonalRecordsController {
  constructor(private readonly records: PersonalRecordsService) {}

  @Get()
  @ApiOperation({ summary: 'Get heaviest, highest-volume, and estimated 1RM records' })
  get(@Param('userId') userId: string, @Query() query: PrQueryDto) {
    return this.records.get(userId, query);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare personal records across two date ranges' })
  compare(@Param('userId') userId: string, @Query() query: ComparePrQueryDto) {
    return this.records.compare(userId, query);
  }
}
