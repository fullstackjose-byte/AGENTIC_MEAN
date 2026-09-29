import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { AuditEvent } from '../../domain/audit/audit-event.js';

export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
    return Promise.resolve();
  }

  findByTicketId(ticketId: string): Promise<AuditEvent[]> {
    return Promise.resolve(
      this.events
        .filter((event) => event.ticketId === ticketId)
        .toSorted((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map((event) => structuredClone(event)),
    );
  }
}
