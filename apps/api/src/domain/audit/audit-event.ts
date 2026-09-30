export type AuditEventType =
  | 'TICKET_CREATED'
  | 'TICKET_CLASSIFIED'
  | 'TICKET_CANCELLED'
  | 'DIAGNOSTIC_STARTED'
  | 'MODEL_CLASSIFICATION_FAILED'
  | 'TRANSITION_REJECTED'
  | 'TICKET_ESCALATED'
  | 'USER_INFORMATION_REQUESTED'
  | 'USER_INFORMATION_RECEIVED'
  | 'DIAGNOSTIC_REJECTED'
  | 'DIAGNOSTIC_COMPLETED'
  | 'REMEDIATION_PROPOSED'
  | 'REMEDIATION_APPROVED'
  | 'REMEDIATION_REJECTED'
  | 'TICKET_RESOLVED'
  | 'TICKET_CLOSED'
  | 'TICKET_REOPENED';

export interface AuditEvent {
  id: string;
  ticketId: string;
  type: AuditEventType;
  actorId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
}
