import {
  BadRequestException,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../http-exception.filter.js';

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

    new HttpExceptionFilter(logger as never).catch(
      new BadRequestException(['unit must be kg or lb']),
      host,
    );

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

    new HttpExceptionFilter(logger as never).catch(
      { type: 'entity.too.large', status: 413, stack: 'private stack' },
      host,
    );

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request failed',
      details: [],
      requestId: 'request-123',
    });
  });

  it('assigns a request id when the body parser rejects before pino-http runs', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const setHeader = vi.fn();
    const logger = { error: vi.fn(), warn: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({ status, setHeader, headersSent: false }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch(
      { type: 'entity.too.large', status: 413 },
      host,
    );

    const payload = json.mock.calls[0]?.[0] as { requestId: string };
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', payload.requestId);
  });

  it('reuses a safe client-supplied x-request-id on early rejections', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const logger = { error: vi.fn(), warn: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-request-id': 'client-trace-1' } }),
        getResponse: () => ({ status, setHeader: vi.fn(), headersSent: false }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch(
      { type: 'entity.too.large', status: 413 },
      host,
    );

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'client-trace-1' }));
  });

  it('preserves explicit array details for non-5xx responses', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const logger = { error: vi.fn(), warn: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-123' }),
        getResponse: () => ({ status }),
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch(
      new HttpException(
        { message: 'Cursor is malformed', details: ['cursor must be a UUID'] },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: ['cursor must be a UUID'],
      }),
    );
  });

  it('keeps details null for 5xx responses', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const logger = { error: vi.fn(), warn: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-123' }),
        getResponse: () => ({ status }),
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch(
      new Error('private error'),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        details: null,
      }),
    );
  });
});
