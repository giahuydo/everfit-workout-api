import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { WeightUnit } from '../../units/units.service.js';

export class HistoryQueryDto {
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(120)
  exerciseName?: string;

  @IsOptional() @IsString() @MaxLength(80)
  muscleGroup?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional() @IsIn(['kg', 'lb'])
  unit: WeightUnit = 'kg';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;

  @IsOptional() @IsString() @MaxLength(2048)
  cursor?: string;
}
