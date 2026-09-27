import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UnitsService } from '../units.service.js';

const units = new UnitsService();

describe('UnitsService', () => {
  it.each([
    [100, 'kg', '100.000000'],
    [100, 'lb', '45.359237'],
    [1, 'lb', '0.453592'],
    // 0.00045359237 rounds half-up at the sixth decimal.
    [0.001, 'lb', '0.000454'],
    // Binary float noise from the caller does not leak into canonical kg.
    [0.1 + 0.2, 'kg', '0.300000'],
  ] as const)('stores %s %s as canonical kg %s', (weight, unit, kg) => {
    expect(units.toKg(weight, unit)).toBe(kg);
  });

  it.each([
    ['100', 'kg', 100],
    ['100', 'lb', 220.462],
    ['45.359237', 'lb', 100],
    // Half-up, not banker's rounding.
    ['0.0005', 'kg', 0.001],
  ] as const)('displays %s kg as %s %s', (kg, unit, displayed) => {
    expect(units.fromKg(kg, unit)).toBe(displayed);
  });

  it.each([0.5, 45, 100, 225.5, 315.125, 99999.999])(
    'round-trips %s lb through canonical kg without drift',
    (lb) => {
      expect(units.fromKg(units.toKg(lb, 'lb'), 'lb')).toBe(lb);
    },
  );

  it('converts volume once from the exact kg product', () => {
    // 8 reps x 180 lb = 8 x 81.646627 kg = 653.173016 kg·reps.
    expect(units.volumeFromKg('653.173016', 'kg')).toBe(653.173);
    expect(units.volumeFromKg('653.173016', 'lb')).toBe(1440);
  });

  it('rejects units outside the registry', () => {
    expect(() => units.assertUnit('stone')).toThrow(BadRequestException);
    expect(() => units.toKg(1, 'stone' as never)).toThrow('Unsupported unit: stone');
  });
});
