import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { WeightUnit } from '../../units/units.service.js';

export class PrQueryDto {
  @IsString() @Matches(/\S/) @MaxLength(120)
  exerciseName!: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional() @IsIn(['kg', 'lb'])
  unit: WeightUnit = 'kg';
}

export class ComparePrQueryDto {
  @IsString() @Matches(/\S/) @MaxLength(120)
  exerciseName!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeAFrom!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeATo!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeBFrom!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeBTo!: string;

  @IsOptional() @IsIn(['kg', 'lb'])
  unit: WeightUnit = 'kg';
}
