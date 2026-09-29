import { BadRequestException } from '@nestjs/common';
import { createProblemDetails } from './problem-details.filter.js';

describe('createProblemDetails', () => {
  it('creates a traceable problem and redacts secrets', () => {
    expect(
      createProblemDetails(
        new BadRequestException('token=abcdefghijk is invalid'),
        '/api/v1/tickets',
        'trace-1',
        new Date('2026-09-29T12:00:00.000Z'),
      ),
    ).toEqual({
      type: 'https://helpdesk.local/problems/http-400',
      title: 'Bad Request',
      status: 400,
      detail: 'token=[REDACTED] is invalid',
      instance: '/api/v1/tickets',
      correlationId: 'trace-1',
      timestamp: '2026-09-29T12:00:00.000Z',
    });
  });

  it('does not expose unexpected internal errors', () => {
    const problem = createProblemDetails(
      new Error('database password=hunter2'),
      '/api/v1/tickets',
      null,
    );
    expect(problem.status).toBe(500);
    expect(problem.detail).toBe('An unexpected error occurred');
  });
});
