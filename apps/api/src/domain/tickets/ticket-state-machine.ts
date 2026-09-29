export type TicketStatus =
  | 'NEW'
  | 'CLASSIFIED'
  | 'IN_DIAGNOSIS'
  | 'PENDING_USER'
  | 'PENDING_APPROVAL'
  | 'IN_REMEDIATION'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

const allowedTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ['CLASSIFIED', 'CANCELLED'],
  CLASSIFIED: ['IN_DIAGNOSIS', 'ESCALATED'],
  IN_DIAGNOSIS: [
    'PENDING_USER',
    'PENDING_APPROVAL',
    'IN_REMEDIATION',
    'ESCALATED',
  ],
  PENDING_USER: ['IN_DIAGNOSIS'],
  PENDING_APPROVAL: ['IN_REMEDIATION', 'ESCALATED'],
  IN_REMEDIATION: ['RESOLVED', 'ESCALATED'],
  ESCALATED: ['IN_DIAGNOSIS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: [],
  REOPENED: ['IN_DIAGNOSIS'],
  CANCELLED: [],
};

export class InvalidTicketTransitionError extends Error {
  constructor(from: TicketStatus, to: TicketStatus) {
    super(`Ticket transition ${from} -> ${to} is not allowed`);
    this.name = 'InvalidTicketTransitionError';
  }
}

export function canTransitionTicket(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTicketTransition(
  from: TicketStatus,
  to: TicketStatus,
): void {
  if (!canTransitionTicket(from, to)) {
    throw new InvalidTicketTransitionError(from, to);
  }
}
