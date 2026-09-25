import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

@Injectable()
export class UnitsService {
  private readonly kgPerUnit: Record<WeightUnit, Decimal> = {
    kg: new Decimal(1),
    lb: new Decimal('0.45359237'),
  };

  assertUnit(unit: string): asserts unit is WeightUnit {
    if (!(unit in this.kgPerUnit)) {
      throw new BadRequestException(`Unsupported unit: ${unit}`);
    }
  }

  toKg(value: number | string, unit: WeightUnit): string {
    this.assertUnit(unit);
    return new Decimal(String(value))
      .times(this.kgPerUnit[unit])
      .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
      .toFixed(6);
  }

  fromKg(value: number | string, unit: WeightUnit, scale = 3): number {
    this.assertUnit(unit);
    return new Decimal(String(value))
      .div(this.kgPerUnit[unit])
      .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  volumeFromKg(value: number | string, unit: WeightUnit): number {
    return this.fromKg(value, unit, 3);
  }
}
