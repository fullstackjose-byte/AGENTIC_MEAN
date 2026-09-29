import type {
  TicketPage,
  TicketPageCriteria,
  TicketRepository,
} from '../../domain/tickets/ticket.repository.js';
import type { Ticket } from '../../domain/tickets/ticket.js';

export class InMemoryTicketRepository implements TicketRepository {
  private readonly tickets = new Map<string, Ticket>();

  constructor(initialTickets: readonly Ticket[] = []) {
    for (const ticket of initialTickets) this.tickets.set(ticket.id, ticket);
  }

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id, ticket);
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.tickets.get(id) ?? null;
  }

  async findPage(criteria: TicketPageCriteria): Promise<TicketPage> {
    const search = criteria.search?.toLocaleLowerCase();
    const matches = [...this.tickets.values()]
      .filter((ticket) => !criteria.status || ticket.status === criteria.status)
      .filter(
        (ticket) => !criteria.priority || ticket.priority === criteria.priority,
      )
      .filter(
        (ticket) =>
          !criteria.requesterId || ticket.requesterId === criteria.requesterId,
      )
      .filter(
        (ticket) =>
          !search ||
          ticket.subject.toLocaleLowerCase().includes(search) ||
          ticket.number.toLocaleLowerCase().includes(search),
      )
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      )
      .filter((ticket) => {
        if (!criteria.after) return true;
        const timestampDifference =
          ticket.createdAt.getTime() - criteria.after.createdAt.getTime();
        return (
          timestampDifference < 0 ||
          (timestampDifference === 0 && ticket.id < criteria.after.id)
        );
      });
    return {
      items: matches.slice(0, criteria.limit),
      hasNextPage: matches.length > criteria.limit,
    };
  }
}
