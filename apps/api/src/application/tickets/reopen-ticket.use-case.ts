import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import {
  type LifecycleDependencies,
  type LifecycleInput,
  validate,
} from './close-ticket.use-case.js';
import { TicketNotFoundError } from './get-ticket.use-case.js';
import { randomUUID } from 'node:crypto';

export class ReopenTicketUseCase {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly audit: AuditEventRepository,
    private readonly dependencies: LifecycleDependencies = {
      nextId: randomUUID,
      now: () => new Date(),
    },
  ) {}

  async execute(ticketId: string, input: LifecycleInput) {
    validate(input);
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new TicketNotFoundError(ticketId);
    const updated = ticket.reopen();
    const changedAt = this.dependencies.now();
    await this.tickets.save(updated);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId,
      type: 'TICKET_REOPENED',
      actorId: input.actorId,
      metadata: { reason: input.reason },
      createdAt: changedAt,
    });
    return { ticketId, status: updated.status, changedAt };
  }
}
