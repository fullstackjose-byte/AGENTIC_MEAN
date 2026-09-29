export type TicketImpact = 'SINGLE_USER' | 'MULTIPLE_USERS' | 'WIDESPREAD';
export type TicketUrgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface PriorityInput {
  impact: TicketImpact;
  urgency: TicketUrgency;
}

export function calculatePriority({ impact, urgency }: PriorityInput): TicketPriority {
  if (impact === 'WIDESPREAD' && urgency === 'HIGH') return 'P1';
  if (impact === 'WIDESPREAD' || urgency === 'HIGH') return 'P2';
  if (impact === 'MULTIPLE_USERS' || urgency === 'MEDIUM') return 'P3';
  return 'P4';
}
