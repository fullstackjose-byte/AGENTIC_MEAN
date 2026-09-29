import {
  HttpErrorResponse,
  HttpResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { RequestTrackingService } from './request-tracking.service';

export const correlationIdInterceptor: HttpInterceptorFn = (request, next) => {
  const tracking = inject(RequestTrackingService);
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          tracking.record(event.headers.get('X-Correlation-Id'));
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          tracking.record(error.headers.get('X-Correlation-Id'));
        }
      },
    }),
  );
};
