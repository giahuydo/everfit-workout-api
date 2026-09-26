import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { errorSchema, validationError } from '../common/openapi-responses.js';
import { LogWorkoutDto } from './dto/log-workout.dto.js';
import {
  augustLogResponse,
  emptyHistoryExample,
  historyExample,
  historyResponseSchema,
  logResponseSchema,
  workoutRequestExamples,
} from './workouts.openapi-examples.js';

export function ApiLogWorkout(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Log one or more exercises atomically',
      description:
        'Select an example below to test valid requests and common validation errors.',
    }),
    ApiParam({
      name: 'userId',
      example: 'demo-user-001',
      description: 'Client/user identifier',
    }),
    ApiBody({
      schema: { $ref: getSchemaPath(LogWorkoutDto) },
      examples: workoutRequestExamples,
    }),
    ApiCreatedResponse({
      description:
        'One entry per exercise occurrence, with original set values in submitted order',
      content: {
        'application/json': {
          schema: logResponseSchema,
          examples: {
            augustBaseline: {
              summary: 'August workout logged (201)',
              value: augustLogResponse,
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Request validation failed',
      content: {
        'application/json': {
          schema: errorSchema,
          examples: {
            unsupportedUnit: {
              summary: 'Unsupported unit',
              value: validationError('Request validation failed', [
                'exercises.0.sets.0.unit must be one of the following values: kg, lb',
              ]),
            },
            invalidValues: {
              summary: 'Negative reps and weight',
              value: validationError('Request validation failed', [
                'exercises.0.sets.0.reps must not be less than 1',
                'exercises.0.sets.0.weight must not be less than 0',
              ]),
            },
            emptySets: {
              summary: 'Empty sets',
              value: validationError('Request validation failed', [
                'exercises.0.sets must contain at least 1 elements',
              ]),
            },
            missingOrNullDate: {
              summary: 'Missing or null date',
              value: validationError('Request validation failed', [
                'date must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression',
                'date must be a string',
              ]),
            },
            malformedDate: {
              summary: 'Malformed date (e.g. 20-09-2026)',
              value: validationError('Request validation failed', [
                'date must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression',
              ]),
            },
            impossibleDate: {
              summary: 'Impossible calendar date (e.g. 2026-02-30)',
              value: validationError('date is not a valid calendar date'),
            },
          },
        },
      },
    }),
    ApiPayloadTooLargeResponse({
      description: 'Body exceeds the 256 KiB limit',
      content: {
        'application/json': {
          schema: errorSchema,
          examples: {
            bodyTooLarge: {
              summary: 'Body exceeds 256 KiB',
              value: {
                ...validationError('Request failed'),
                statusCode: 413,
                code: 'PAYLOAD_TOO_LARGE',
              },
            },
          },
        },
      },
    }),
  );
}

export function ApiWorkoutHistory(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Query workout history with cursor pagination',
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
        'History pages entries before loading their sets; optional message only for empty results',
      content: {
        'application/json': {
          schema: historyResponseSchema,
          examples: {
            withWorkouts: {
              summary: 'Bench Press history (illustrative page)',
              value: historyExample,
            },
            noData: {
              summary:
                'No workouts (200; change exerciseName to an unknown name)',
              value: emptyHistoryExample,
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid filter, user ID, date range, unit, or cursor',
      content: {
        'application/json': {
          schema: errorSchema,
          examples: {
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
            malformedCursor: {
              summary: 'Malformed cursor (cursor=invalid)',
              value: validationError('Invalid cursor for the current query'),
            },
            cursorScopeMismatch: {
              summary: 'Cursor reused with different filters or limit',
              value: validationError('Invalid cursor for the current query'),
            },
          },
        },
      },
    }),
  );
}
