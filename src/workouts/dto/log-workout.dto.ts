import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WEIGHT_UNITS, type WeightUnit } from '../../units/units.service.js';

export class WorkoutSetInputDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  reps!: number;

  @ApiProperty({ example: 100, minimum: 0, maximum: 100000 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000)
  weight!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'kg' })
  @IsIn(WEIGHT_UNITS)
  unit!: WeightUnit;
}

export class ExerciseLogInputDto {
  @ApiProperty({ example: 'Bench Press', maxLength: 120 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  exerciseName!: string;

  @ApiProperty({ type: () => [WorkoutSetInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetInputDto)
  sets!: WorkoutSetInputDto[];
}

export class LogWorkoutDto {
  @ApiProperty({ example: '2026-09-15', format: 'date' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ type: () => [ExerciseLogInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExerciseLogInputDto)
  exercises!: ExerciseLogInputDto[];
}
