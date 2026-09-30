import { describe, expect, it } from 'vitest';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { CreateTicketUseCase } from './create-ticket.use-case.js';

describe('CreateTicketUseCase', () => {
  it('creates a new ticket with deterministic identity and timestamps', async () => {
    const repository = new InMemoryTicketRepository();
    const useCase = new CreateTicketUseCase(repository, {
      nextId: () => '11111111-1111-4111-8111-111111111111',
      nextTicketNumber: () => 'TCK-2026-000001',
      now: () => new Date('2026-09-29T15:00:00.000Z'),
    });

    const ticket = await useCase.execute({
      subject: 'No puedo conectarme a la VPN',
      description: 'La conexión falla desde esta mañana',
      requesterId: 'user-123',
    });

    expect(ticket).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      number: 'TCK-2026-000001',
      status: 'NEW',
      priority: 'P4',
      subject: 'No puedo conectarme a la VPN',
      requesterId: 'user-123',
    });
    expect(ticket.createdAt.toISOString()).toBe('2026-09-29T15:00:00.000Z');
    await expect(repository.findById(ticket.id)).resolves.toEqual(ticket);
  });

  it('redacts secrets before persisting the description', async () => {
    const repository = new InMemoryTicketRepository();
    const useCase = new CreateTicketUseCase(repository, {
      nextId: () => '22222222-2222-4222-8222-222222222222',
      nextTicketNumber: () => 'TCK-2026-000002',
      now: () => new Date('2026-09-29T15:00:00.000Z'),
    });

    const ticket = await useCase.execute({
      subject: 'Cuenta bloqueada',
      description: 'Mi password=SuperSecret123 dejó de funcionar',
      requesterId: 'user-456',
    });

    expect(ticket.description).toBe('Mi password=[REDACTED] dejó de funcionar');
    expect(ticket.containsRedactedData).toBe(true);
  });

  it('redacts PII from subject and description before persistence', async () => {
    const repository = new InMemoryTicketRepository();
    const useCase = new CreateTicketUseCase(repository, {
      nextId: () => '33333333-3333-4333-8333-333333333333',
      nextTicketNumber: () => 'TCK-2026-000003',
      now: () => new Date('2026-09-29T15:00:00.000Z'),
    });
    const ticket = await useCase.execute({
      subject: 'Correo ana@example.com',
      description: 'Llámame al +57 310 555 1234 desde 192.168.1.20',
      requesterId: 'user-safe',
    });
    expect(ticket.subject).toBe('Correo [EMAIL_REDACTED]');
    expect(ticket.description).not.toMatch(/310|192\.168/);
    expect(ticket.containsRedactedData).toBe(true);
  });

  it('rejects requester PII before persistence', async () => {
    const repository = new InMemoryTicketRepository();
    const useCase = new CreateTicketUseCase(repository);
    await expect(
      useCase.execute({
        subject: 'VPN',
        description: 'No conecta',
        requesterId: 'person@example.com',
      }),
    ).rejects.toThrow('opaque');
    await expect(repository.findPage({ limit: 10 })).resolves.toMatchObject({
      items: [],
    });
  });

  it.each([
    ['', 'Descripción válida', 'user-1'],
    ['Asunto válido', '', 'user-1'],
    ['Asunto válido', 'Descripción válida', ''],
  ])('rejects incomplete input', async (subject, description, requesterId) => {
    const useCase = new CreateTicketUseCase(new InMemoryTicketRepository(), {
      nextId: () => 'unused',
      nextTicketNumber: () => 'unused',
      now: () => new Date(),
    });

    await expect(
      useCase.execute({ subject, description, requesterId }),
    ).rejects.toThrow('required');
  });
});
