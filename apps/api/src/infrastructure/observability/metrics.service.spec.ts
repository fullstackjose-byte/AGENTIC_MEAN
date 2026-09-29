import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('exports request, server error and duration counters', () => {
    const metrics = new MetricsService();
    metrics.record(200, 12);
    metrics.record(503, 8);
    expect(metrics.render()).toContain('helpdesk_http_requests_total 2');
    expect(metrics.render()).toContain('helpdesk_http_errors_total 1');
    expect(metrics.render()).toContain(
      'helpdesk_http_request_duration_milliseconds_total 20',
    );
  });
});
