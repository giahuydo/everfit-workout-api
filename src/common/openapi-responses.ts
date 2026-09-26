// Shared OpenAPI error envelope; example request IDs are illustrative only.
import type { SchemaObject } from '@nestjs/swagger';

const requestId = '7a3f3f33-0fc3-4fd4-8c56-2037ab75654e';

export const errorSchema = {
  type: 'object',
  required: ['statusCode', 'code', 'message', 'details', 'requestId'],
  properties: {
    statusCode: { type: 'integer', example: 400 },
    code: { type: 'string', example: 'VALIDATION_ERROR' },
    message: { type: 'string', example: 'Request validation failed' },
    details: { type: 'array', items: { type: 'string' }, nullable: true },
    requestId: { type: 'string', example: requestId },
  },
} satisfies SchemaObject;

export const validationError = (message: string, details: string[] = []) => ({
  statusCode: 400,
  code: 'VALIDATION_ERROR',
  message,
  details,
  requestId,
});
