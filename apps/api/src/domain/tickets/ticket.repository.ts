import type { Ticket } from './ticket.js';
import type { TicketPriority } from './priority-policy.js';
import type { TicketStatus } from './ticket-state-machine.js';

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

export interface TicketRepository {
  save(ticket: Ticket): Promise<void>;
  findById(id: string): Promise<Ticket | null>;
  findPage(criteria: TicketPageCriteria): Promise<TicketPage>;
}

export interface TicketCursor {
  createdAt: Date;
  id: string;
}

export interface TicketPageCriteria {
  limit: number;
  after?: TicketCursor;
  status?: TicketStatus;
  priority?: TicketPriority;
  requesterId?: string;
  search?: string;
}

export interface TicketPage {
  items: Ticket[];
  hasNextPage: boolean;
}
