import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private requests = 0;
  private errors = 0;
  private totalDurationMs = 0;

  record(statusCode: number, durationMs: number): void {
    this.requests += 1;
    this.totalDurationMs += durationMs;
    if (statusCode >= 500) this.errors += 1;
  }

  render(): string {
    return [
      '# HELP helpdesk_http_requests_total Total HTTP requests.',
      '# TYPE helpdesk_http_requests_total counter',
      `helpdesk_http_requests_total ${this.requests}`,
      '# HELP helpdesk_http_errors_total Total HTTP responses with status 5xx.',
      '# TYPE helpdesk_http_errors_total counter',
      `helpdesk_http_errors_total ${this.errors}`,
      '# HELP helpdesk_http_request_duration_milliseconds_total Accumulated request duration.',
      '# TYPE helpdesk_http_request_duration_milliseconds_total counter',
      `helpdesk_http_request_duration_milliseconds_total ${this.totalDurationMs}`,
      '',
    ].join('\n');
  }
}
