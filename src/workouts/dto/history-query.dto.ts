import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WEIGHT_UNITS, type WeightUnit } from '../../units/units.service.js';

export class HistoryQueryDto {
  @ApiPropertyOptional({
    example: 'Bench Press',
    description: 'Literal partial exercise-name match',
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  exerciseName?: string;

  @ApiPropertyOptional({ example: 'chest' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  muscleGroup?: string;

  @ApiPropertyOptional({ example: '2026-08-01', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ enum: WEIGHT_UNITS, default: 'kg', example: 'kg' })
  @IsOptional()
  @IsIn(WEIGHT_UNITS)
  unit: WeightUnit = 'kg';

  @ApiPropertyOptional({
    type: Number,
    default: 20,
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;
}
