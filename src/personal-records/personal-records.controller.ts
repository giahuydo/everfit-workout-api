import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ComparePrQueryDto, PrQueryDto } from './dto/pr-query.dto.js';
import {
  ApiComparePersonalRecords,
  ApiGetPersonalRecords,
} from './personal-records.openapi.js';
import { PersonalRecordsService } from './personal-records.service.js';

@ApiTags('personal-records')
@Controller('v1/users/:userId/personal-records')
export class PersonalRecordsController {
  constructor(private readonly records: PersonalRecordsService) {}

  @Get()
  @ApiGetPersonalRecords()
  get(@Param('userId') userId: string, @Query() query: PrQueryDto) {
    return this.records.get(userId, query);
  }

  @Get('compare')
  @ApiComparePersonalRecords()
  compare(@Param('userId') userId: string, @Query() query: ComparePrQueryDto) {
    return this.records.compare(userId, query);
  }
}
