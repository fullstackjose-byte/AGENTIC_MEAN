import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';
import { MetricsService } from './metrics.service.js';
import { RequestContextService } from './request-context.service.js';
import { RequestObservabilityInterceptor } from './request-observability.interceptor.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Global()
@Module({
  providers: [
    RequestContextService,
    CorrelationIdMiddleware,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: RequestObservabilityInterceptor },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  exports: [RequestContextService, CorrelationIdMiddleware, MetricsService],
})
export class ObservabilityModule {}
