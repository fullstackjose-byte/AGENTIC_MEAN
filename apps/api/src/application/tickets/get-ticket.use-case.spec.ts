import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { GetTicketUseCase, TicketNotFoundError } from './get-ticket.use-case.js';

const ticket = Ticket.create({
  id: '11111111-1111-4111-8111-111111111111',
  number: 'TCK-2026-000001',
  subject: 'VPN no conecta',
  description: 'Error de conectividad',
  requesterId: 'user-123',
  createdAt: new Date('2026-09-29T15:00:00.000Z'),
  containsRedactedData: false,
});

describe('GetTicketUseCase', () => {
  it('returns an existing ticket', async () => {
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new GetTicketUseCase(repository);

    await expect(useCase.execute(ticket.id)).resolves.toEqual(ticket);
  });

  it('throws a typed error when the ticket does not exist', async () => {
    const useCase = new GetTicketUseCase(new InMemoryTicketRepository());
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      TicketNotFoundError,
    );
  });
});
