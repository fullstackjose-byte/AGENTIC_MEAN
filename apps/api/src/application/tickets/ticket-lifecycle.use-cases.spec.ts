import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import { InMemoryAuditEventRepository } from '../../infrastructure/persistence/in-memory-audit-event.repository.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { CloseTicketUseCase } from './close-ticket.use-case.js';
import { GetTicketTimelineUseCase } from './get-ticket-timeline.use-case.js';
import { ReopenTicketUseCase } from './reopen-ticket.use-case.js';

const resolvedTicket = () =>
  Ticket.restore({
    id: '11111111-1111-4111-8111-111111111111',
    number: 'TCK-2026-000001',
    subject: 'VPN no conecta',
    description: 'Problema resuelto',
    requesterId: 'user-123',
    createdAt: new Date('2026-09-29T15:00:00.000Z'),
    containsRedactedData: false,
    status: 'RESOLVED',
    priority: 'P3',
  });

const dependencies = {
  nextId: () => 'audit-1',
  now: () => new Date('2026-09-29T20:00:00.000Z'),
};

describe('ticket lifecycle and audit timeline', () => {
  it('closes a resolved ticket and appends an audit event', async () => {
    const tickets = new InMemoryTicketRepository([resolvedTicket()]);
    const audit = new InMemoryAuditEventRepository();
    const useCase = new CloseTicketUseCase(tickets, audit, dependencies);

    await expect(
      useCase.execute(resolvedTicket().id, {
        actorId: 'support-1',
        reason: 'Usuario confirmó la solución',
      }),
    ).resolves.toMatchObject({ status: 'CLOSED' });
    await expect(audit.findByTicketId(resolvedTicket().id)).resolves.toEqual([
      expect.objectContaining({
        type: 'TICKET_CLOSED',
        actorId: 'support-1',
      }),
    ]);
  });

  it('reopens a resolved ticket when the problem persists', async () => {
    const tickets = new InMemoryTicketRepository([resolvedTicket()]);
    const audit = new InMemoryAuditEventRepository();
    const useCase = new ReopenTicketUseCase(tickets, audit, dependencies);

    await expect(
      useCase.execute(resolvedTicket().id, {
        actorId: 'user-123',
        reason: 'El problema volvió a presentarse',
      }),
    ).resolves.toMatchObject({ status: 'REOPENED' });
  });

  it('returns the append-only timeline in chronological order', async () => {
    const audit = new InMemoryAuditEventRepository();
    await audit.append({
      id: 'audit-2',
      ticketId: resolvedTicket().id,
      type: 'TICKET_RESOLVED',
      actorId: 'system',
      metadata: { summary: 'Verificado' },
      createdAt: new Date('2026-09-29T19:00:00.000Z'),
    });
    await audit.append({
      id: 'audit-1',
      ticketId: resolvedTicket().id,
      type: 'TICKET_CREATED',
      actorId: 'user-123',
      metadata: {},
      createdAt: new Date('2026-09-29T15:00:00.000Z'),
    });

    const timeline = await new GetTicketTimelineUseCase(audit).execute(
      resolvedTicket().id,
    );

    expect(timeline.map((event) => event.type)).toEqual([
      'TICKET_CREATED',
      'TICKET_RESOLVED',
    ]);
  });
});
