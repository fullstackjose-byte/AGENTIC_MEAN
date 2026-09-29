import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';

export class GetTicketTimelineUseCase {
  constructor(private readonly audit: AuditEventRepository) {}

  execute(ticketId: string) {
    return this.audit.findByTicketId(ticketId);
  }
}
