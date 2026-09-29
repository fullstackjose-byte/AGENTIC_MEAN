import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { ListTicketsUseCase } from './list-tickets.use-case.js';

describe('ListTicketsUseCase', () => {
  it('returns filtered cursor pages newest first', async () => {
    const older = Ticket.create({
      id: 'older', number: 'TCK-2026-000001', subject: 'Older',
      description: 'Old ticket', requesterId: 'user-1',
      createdAt: new Date('2026-09-28T10:00:00Z'), containsRedactedData: false,
    });
    const newer = Ticket.create({
      id: 'newer', number: 'TCK-2026-000002', subject: 'Newer',
      description: 'New ticket', requesterId: 'user-2',
      createdAt: new Date('2026-09-29T10:00:00Z'), containsRedactedData: false,
    });
    const useCase = new ListTicketsUseCase(
      new InMemoryTicketRepository([older, newer]),
    );

    const first = await useCase.execute({ limit: 1 });
    expect(first.items).toEqual([newer]);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(first.pageInfo.nextCursor).toBeTruthy();

    const second = await useCase.execute({
      limit: 1,
      cursor: first.pageInfo.nextCursor!,
      priority: 'P4',
      search: 'older',
    });
    expect(second).toEqual({
      items: [older],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
  });

  it('rejects invalid pagination and filter values', async () => {
    const useCase = new ListTicketsUseCase(new InMemoryTicketRepository());
    await expect(useCase.execute({ limit: 0 })).rejects.toThrow('limit');
    await expect(useCase.execute({ status: 'UNKNOWN' })).rejects.toThrow('status');
    await expect(useCase.execute({ cursor: 'invalid' })).rejects.toThrow('cursor');
  });
});
