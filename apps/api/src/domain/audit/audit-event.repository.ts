import type { AuditEvent } from './audit-event.js';

export const AUDIT_EVENT_REPOSITORY = Symbol('AUDIT_EVENT_REPOSITORY');

export interface AuditEventRepository {
  append(event: AuditEvent): Promise<void>;
  findByTicketId(ticketId: string): Promise<AuditEvent[]>;
}

export const NOOP_AUDIT_EVENT_REPOSITORY: AuditEventRepository = {
  append: () => Promise.resolve(),
  findByTicketId: () => Promise.resolve([]),
};
