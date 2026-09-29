import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { Ticket } from '../../domain/tickets/ticket.js';
import type { TicketPriority } from '../../domain/tickets/priority-policy.js';
import type { TicketStatus } from '../../domain/tickets/ticket-state-machine.js';

const STATUSES: readonly TicketStatus[] = [
  'NEW', 'CLASSIFIED', 'IN_DIAGNOSIS', 'PENDING_USER', 'PENDING_APPROVAL',
  'IN_REMEDIATION', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED',
];
const PRIORITIES: readonly TicketPriority[] = ['P1', 'P2', 'P3', 'P4'];

export interface ListTicketsQuery {
  limit?: number;
  cursor?: string;
  status?: string;
  priority?: string;
  requesterId?: string;
  search?: string;
}

export interface TicketConnection {
  items: Ticket[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}

export class InvalidTicketQueryError extends Error {}

export class ListTicketsUseCase {
  constructor(private readonly repository: TicketRepository) {}

  async execute(query: ListTicketsQuery = {}): Promise<TicketConnection> {
    const limit = query.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new InvalidTicketQueryError('limit must be an integer from 1 to 100');
    }
    if (query.status && !STATUSES.includes(query.status as TicketStatus)) {
      throw new InvalidTicketQueryError('status is not valid');
    }
    if (query.priority && !PRIORITIES.includes(query.priority as TicketPriority)) {
      throw new InvalidTicketQueryError('priority is not valid');
    }
    if (query.search && query.search.trim().length > 100) {
      throw new InvalidTicketQueryError('q must not exceed 100 characters');
    }

    const page = await this.repository.findPage({
      limit,
      after: query.cursor ? decodeCursor(query.cursor) : undefined,
      status: query.status as TicketStatus | undefined,
      priority: query.priority as TicketPriority | undefined,
      requesterId: query.requesterId,
      search: query.search?.trim() || undefined,
    });
    const last = page.items.at(-1);
    return {
      items: page.items,
      pageInfo: {
        hasNextPage: page.hasNextPage,
        nextCursor:
          page.hasNextPage && last
            ? encodeCursor(last.createdAt, last.id)
            : null,
      },
    };
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }))
    .toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };
    const createdAt = new Date(String(value.createdAt));
    if (typeof value.id !== 'string' || !value.id || Number.isNaN(createdAt.getTime())) {
      throw new Error('invalid');
    }
    return { createdAt, id: value.id };
  } catch {
    throw new InvalidTicketQueryError('cursor is not valid');
  }
}
