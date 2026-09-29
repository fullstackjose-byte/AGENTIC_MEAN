import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RequestTrackingService {
  readonly lastCorrelationId = signal<string | null>(null);

  record(correlationId: string | null): void {
    if (correlationId) this.lastCorrelationId.set(correlationId);
  }
}
