import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service.js';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';
const VALID_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    @Inject(RequestContextService)
    private readonly context: RequestContextService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header(CORRELATION_ID_HEADER);
    const correlationId =
      supplied && VALID_CORRELATION_ID.test(supplied) ? supplied : randomUUID();
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    this.context.run({ correlationId }, next);
  }
}
