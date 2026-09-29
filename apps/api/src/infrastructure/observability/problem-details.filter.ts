import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestContextService } from './request-context.service.js';
import { redactSecrets } from '../../domain/security/secret-redactor.js';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlationId: string | null;
  timestamp: string;
}

const TITLES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(
    @Inject(RequestContextService)
    private readonly context: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const problem = createProblemDetails(
      exception,
      request.originalUrl,
      this.context.correlationId ?? null,
    );
    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }
}

export function createProblemDetails(
  exception: unknown,
  instance: string,
  correlationId: string | null,
  now = new Date(),
): ProblemDetails {
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  const detail =
    status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'An unexpected error occurred'
      : extractDetail(exception);
  return {
      type: `https://helpdesk.local/problems/http-${status}`,
      title:
        TITLES[status] ??
        (status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : 'Request Failed'),
      status,
      detail,
      instance,
      correlationId,
      timestamp: now.toISOString(),
    };
}

function extractDetail(exception: unknown): string {
  if (!(exception instanceof HttpException)) return 'An unexpected error occurred';
  const payload = exception.getResponse();
  if (typeof payload === 'string') return redactSecrets(payload).text;
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return redactSecrets(message.map(String).join('; ')).text;
  }
  return redactSecrets(
    typeof message === 'string' ? message : exception.message,
  ).text;
}
