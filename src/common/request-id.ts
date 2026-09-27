import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Reuses a safe client-supplied x-request-id or creates one, and echoes it on
 * the response. Shared by pino-http and the exception filter, because the body
 * parser can reject a request (413) before pino-http has assigned an id.
 */
export function resolveRequestId(request: IncomingMessage, response: ServerResponse): string {
  const supplied = request.headers['x-request-id'];
  const requestId = typeof supplied === 'string' && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
  if (!response.headersSent) response.setHeader('x-request-id', requestId);
  return requestId;
}
