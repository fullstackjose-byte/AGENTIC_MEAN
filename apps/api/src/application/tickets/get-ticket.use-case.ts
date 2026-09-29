import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { Ticket } from '../../domain/tickets/ticket.js';

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Ticket ${id} was not found`);
    this.name = 'TicketNotFoundError';
  }
}

export class GetTicketUseCase {
  constructor(private readonly repository: TicketRepository) {}

  async execute(id: string): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
    if (!ticket) throw new TicketNotFoundError(id);
    return ticket;
  }
}
