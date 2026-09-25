import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  it('maps bad requests to the documented validation error code', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const logger = { error: vi.fn(), warn: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-123' }),
        getResponse: () => ({ status }),
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch(new BadRequestException(['unit must be kg or lb']), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: ['unit must be kg or lb'],
      requestId: 'request-123',
    });
  });

  it('returns the standard envelope for an oversized request without leaking internals', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const logger = { error: vi.fn(), warn: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-123' }),
        getResponse: () => ({ status }),
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch({ type: 'entity.too.large', status: 413, stack: 'private stack' }, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request failed',
      details: null,
      requestId: 'request-123',
    });
  });
});
