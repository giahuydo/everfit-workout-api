import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { errorSchema, validationError } from '../common/openapi-responses.js';
import {
  compareExample,
  compareNoDataExample,
  compareResponseSchema,
  emptyPrResponseExample,
  prResponseSchema,
  septemberPrExample,
} from './personal-records.openapi-examples.js';

export function ApiGetPersonalRecords(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Get heaviest, highest-volume, and estimated 1RM records',
      description:
        'After logging both presets, query Bench Press across August–September 2026.',
    }),
    ApiParam({
      name: 'userId',
      example: 'demo-user-001',
      description: 'Client/user identifier',
    }),
    ApiOkResponse({
      description:
        'Three independent PR metrics; no matching sets return three nulls and a message',
      content: {
        'application/json': {
          schema: prResponseSchema,
          examples: {
            withRecords: {
              summary: 'Bench Press after August and September (200)',
              value: septemberPrExample,
            },
            noData: {
              summary:
                'No records (200; change exerciseName to an unknown name)',
              value: emptyPrResponseExample,
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid user ID, exercise name, date bounds, or unit',
      content: {
        'application/json': {
          schema: errorSchema,
          examples: {
            reversedRange: {
              summary: 'Reversed range (from > to)',
              value: validationError(
                'from must be earlier than or equal to to',
              ),
            },
            invalidDate: {
              summary: 'Invalid calendar date (from=2026-02-30)',
              value: validationError('from is not a valid calendar date'),
            },
            invalidUnit: {
              summary: 'Unsupported unit (unit=stone)',
              value: validationError('Request validation failed', [
                'unit must be one of the following values: kg, lb',
              ]),
            },
            blankUserId: {
              summary: 'Whitespace-only userId (URL-encoded %20)',
              value: validationError('userId must be 1-128 characters'),
            },
            missingExerciseName: {
              summary: 'Missing exerciseName',
              value: validationError('Request validation failed', [
                'exerciseName must be shorter than or equal to 120 characters',
                'exerciseName must match /\\S/ regular expression',
                'exerciseName must be a string',
              ]),
            },
          },
        },
      },
    }),
  );
}

export function ApiComparePersonalRecords(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Compare personal records across two date ranges',
      description:
        'After logging both presets, compare September (A) with August (B) for Bench Press.',
    }),
    ApiParam({
      name: 'userId',
      example: 'demo-user-001',
      description: 'Client/user identifier',
    }),
    ApiOkResponse({
      description:
        'Each inclusive range has its own records and optional no-data message',
      content: {
        'application/json': {
          schema: compareResponseSchema,
          examples: {
            twoRanges: {
              summary: 'September vs August (200)',
              value: compareExample,
            },
            noDataRange: {
              summary:
                'September vs empty July range (200; change rangeB bounds)',
              value: compareNoDataExample,
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid user ID, exercise name, any date bound, or unit',
      content: {
        'application/json': {
          schema: errorSchema,
          examples: {
            invalidRangeA: {
              summary: 'Reversed range A (rangeAFrom > rangeATo)',
              value: validationError(
                'from must be earlier than or equal to to',
              ),
            },
            invalidRangeB: {
              summary: 'Reversed range B (rangeBFrom > rangeBTo)',
              value: validationError(
                'from must be earlier than or equal to to',
              ),
            },
            invalidDate: {
              summary: 'Invalid calendar date (rangeBFrom=2026-02-30)',
              value: validationError('from is not a valid calendar date'),
            },
            invalidUnit: {
              summary: 'Unsupported unit (unit=stone)',
              value: validationError('Request validation failed', [
                'unit must be one of the following values: kg, lb',
              ]),
            },
            missingRangeBTo: {
              summary: 'Missing required rangeBTo',
              value: validationError('Request validation failed', [
                'rangeBTo must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression',
              ]),
            },
          },
        },
      },
    }),
  );
}
