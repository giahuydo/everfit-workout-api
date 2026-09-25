import { Type } from 'class-transformer';
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
  @IsInt()
  @Min(1)
  @Max(10000)
  reps!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000)
  weight!: number;

  @IsIn(WEIGHT_UNITS)
  unit!: WeightUnit;
}

export class ExerciseLogInputDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  exerciseName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetInputDto)
  sets!: WorkoutSetInputDto[];
}

export class LogWorkoutDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExerciseLogInputDto)
  exercises!: ExerciseLogInputDto[];
}
