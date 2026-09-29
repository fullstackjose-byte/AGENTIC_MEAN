import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service.js';
import { RequestContextService } from './request-context.service.js';
import { sanitizeLogValue } from './log-sanitizer.js';
import type { AuthenticatedRequest } from '../../interfaces/auth/auth.types.js';

@Injectable()
export class RequestObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(
    @Inject(RequestContextService) private readonly context: RequestContextService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  intercept(execution: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = execution
      .switchToHttp()
      .getRequest<Request & Partial<AuthenticatedRequest>>();
    const response = execution.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();

    const finish = (error?: unknown) => {
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      const statusCode =
        error instanceof HttpException
          ? error.getStatus()
          : error
            ? 500
            : response.statusCode;
      this.metrics.record(statusCode, durationMs);
      const entry = sanitizeLogValue({
        event: 'http_request',
        correlationId: this.context.correlationId,
        method: request.method,
        path: request.originalUrl,
        statusCode,
        durationMs,
        userId: request.user?.id ?? request.header('X-User-Id'),
        error: error instanceof Error ? error.message : undefined,
      });
      const message = JSON.stringify(entry);
      if (error) this.logger.error(message);
      else this.logger.log(message);
    };

    return next.handle().pipe(
      tap(() => finish()),
      catchError((error: unknown) => {
        finish(error);
        return throwError(() => error);
      }),
    );
  }
}
