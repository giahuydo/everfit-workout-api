import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { fromDateExamples, toDateExamples } from '../../common/openapi-date-examples.js';
import { WEIGHT_UNITS, type WeightUnit } from '../../units/units.service.js';

export class PrQueryDto {
  @ApiProperty({ example: 'Bench Press' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  exerciseName!: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-08-01', examples: fromDateExamples })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-09-30', examples: toDateExamples })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ enum: WEIGHT_UNITS, default: 'kg', example: 'kg' })
  @IsOptional()
  @IsIn(WEIGHT_UNITS)
  unit: WeightUnit = 'kg';
}

export class ComparePrQueryDto {
  @ApiProperty({ example: 'Bench Press' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  exerciseName!: string;

  @ApiProperty({ example: '2026-09-01', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeAFrom!: string;
  @ApiProperty({ example: '2026-09-30', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeATo!: string;
  @ApiProperty({ example: '2026-08-01', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeBFrom!: string;
  @ApiProperty({ example: '2026-08-31', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rangeBTo!: string;

  @ApiPropertyOptional({ enum: WEIGHT_UNITS, default: 'kg', example: 'kg' })
  @IsOptional()
  @IsIn(WEIGHT_UNITS)
  unit: WeightUnit = 'kg';
}
