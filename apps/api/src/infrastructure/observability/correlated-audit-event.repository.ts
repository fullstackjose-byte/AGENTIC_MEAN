import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { AuditEvent } from '../../domain/audit/audit-event.js';
import type { RequestContextService } from './request-context.service.js';

export class CorrelatedAuditEventRepository implements AuditEventRepository {
  constructor(
    private readonly repository: AuditEventRepository,
    private readonly context: RequestContextService,
  ) {}

  append(event: AuditEvent): Promise<void> {
    const correlationId = this.context.correlationId;
    return this.repository.append({
      ...event,
      metadata: correlationId
        ? { ...event.metadata, correlationId }
        : event.metadata,
    });
  }

  findByTicketId(ticketId: string): Promise<AuditEvent[]> {
    return this.repository.findByTicketId(ticketId);
  }
}
