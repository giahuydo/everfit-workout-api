import { BadRequestException } from '@nestjs/common';

export function assertCalendarDate(value: string, field = 'date'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} is not a valid calendar date`);
  }
  return value;
}

export function assertRange(from?: string, to?: string): void {
  if (from) assertCalendarDate(from, 'from');
  if (to) assertCalendarDate(to, 'to');
  if (from && to && from > to) {
    throw new BadRequestException('from must be earlier than or equal to to');
  }
}
