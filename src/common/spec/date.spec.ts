import { describe, expect, it } from 'vitest';
import { assertCalendarDate, assertRange } from '../date.js';

describe('assertCalendarDate', () => {
  it.each(['2024-02-29', '2026-12-31', '0001-01-01'])('accepts %s', (value) => {
    expect(assertCalendarDate(value)).toBe(value);
  });

  it.each([
    ['2026-02-29', 'not a leap year'],
    ['2026-04-31', 'April has 30 days'],
    ['2026-13-01', 'month 13'],
    ['0000-01-01', 'PostgreSQL has no year zero'],
  ])('rejects %s (%s)', (value) => {
    expect(() => assertCalendarDate(value)).toThrow('date is not a valid calendar date');
  });

  it.each(['2026-9-5', '26-09-05', '2026/09/05', '2026-09-05T00:00:00Z', ''])(
    'rejects non YYYY-MM-DD input %j',
    (value) => {
      expect(() => assertCalendarDate(value)).toThrow('date must use YYYY-MM-DD');
    },
  );
});

describe('assertRange', () => {
  it('accepts inclusive single-day, one-sided, and open ranges', () => {
    expect(() => assertRange('2026-09-01', '2026-09-01')).not.toThrow();
    expect(() => assertRange('2026-09-01', undefined)).not.toThrow();
    expect(() => assertRange(undefined, '2026-09-01')).not.toThrow();
    expect(() => assertRange()).not.toThrow();
  });

  it('rejects reversed ranges and names the invalid bound', () => {
    expect(() => assertRange('2026-09-02', '2026-09-01')).toThrow('from must be earlier than or equal to to');
    expect(() => assertRange('2026-02-30', '2026-03-01')).toThrow('from is not a valid calendar date');
    expect(() => assertRange('2026-02-01', '2026-02-30')).toThrow('to is not a valid calendar date');
  });
});
