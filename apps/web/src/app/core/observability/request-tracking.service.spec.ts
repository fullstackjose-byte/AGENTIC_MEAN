import { RequestTrackingService } from './request-tracking.service';

describe('RequestTrackingService', () => {
  it('keeps the latest non-empty correlation ID', () => {
    const tracking = new RequestTrackingService();
    tracking.record('flow-123');
    tracking.record(null);
    expect(tracking.lastCorrelationId()).toBe('flow-123');
  });
});
