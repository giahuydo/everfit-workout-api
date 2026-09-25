import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

interface ErrorResponse {
  message?: string | string[];
  error?: string;
  details?: object;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { id?: string }>();
    const response = context.getResponse<Response>();
    const requestId = request.id ?? 'unknown';
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : this.statusFor(exception);
    const body = isHttpException ? exception.getResponse() : undefined;
    const error = typeof body === 'object' && body !== null ? body as ErrorResponse : {};
    const payload = {
      statusCode,
      code: this.codeFor(exception, statusCode),
      message: this.messageFor(error.message, statusCode),
      details: this.detailsFor(error, statusCode),
      requestId,
    };

    if (statusCode >= 500) {
      this.logger.error({ err: exception, requestId, statusCode, code: payload.code }, 'Unhandled request error');
    } else {
      this.logger.warn({ requestId, statusCode, code: payload.code }, 'Request rejected');
    }
    response.status(statusCode).json(payload);
  }

  private codeFor(exception: unknown, statusCode: number): string {
    if (typeof exception === 'object' && exception !== null && 'type' in exception && exception.type === 'entity.too.large') return 'PAYLOAD_TOO_LARGE';
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) return 'INTERNAL_SERVER_ERROR';
    return `HTTP_${statusCode}`;
  }

  private statusFor(exception: unknown): number {
    if (typeof exception === 'object' && exception !== null && 'status' in exception && typeof exception.status === 'number'
      && exception.status >= 400 && exception.status <= 599) return exception.status;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private messageFor(message: string | string[] | undefined, statusCode: number): string {
    if (Array.isArray(message)) return 'Request validation failed';
    if (typeof message === 'string') return message;
    return statusCode >= 500 ? 'Internal server error' : 'Request failed';
  }

  private detailsFor(error: ErrorResponse, statusCode: number): object | null {
    if (statusCode >= 500) return null;
    if (Array.isArray(error.message)) return error.message;
    return error.details ?? null;
  }
}
