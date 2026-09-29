import { describe, expect, it, vi } from 'vitest';
import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { AuditEvent } from '../../domain/audit/audit-event.js';
import { CorrelatedAuditEventRepository } from './correlated-audit-event.repository.js';
import { RequestContextService } from './request-context.service.js';

describe('CorrelatedAuditEventRepository', () => {
  it('adds correlation and result while redacting secrets', async () => {
    const append = vi.fn<(event: AuditEvent) => Promise<void>>().mockResolvedValue();
    const repository: AuditEventRepository = {
      append,
      findByTicketId: vi.fn().mockResolvedValue([]),
    };
    const context = new RequestContextService();
    const correlated = new CorrelatedAuditEventRepository(repository, context);

    await context.run({ correlationId: 'corr-123' }, () =>
      correlated.append({
        id: 'event-1',
        ticketId: 'ticket-1',
        type: 'DIAGNOSTIC_COMPLETED',
        actorId: 'diagnostic-agent',
        metadata: {
          ticketStatus: 'IN_DIAGNOSIS',
          token: 'secret-token',
          detail: 'Authorization: Bearer top-secret',
        },
        createdAt: new Date('2026-09-29T12:00:00.000Z'),
      }),
    );

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          correlationId: 'corr-123',
          result: 'IN_DIAGNOSIS',
          token: '[REDACTED]',
        }),
      }),
    );
    expect(append.mock.calls[0]?.[0].metadata.detail).not.toContain('top-secret');
  });
});
