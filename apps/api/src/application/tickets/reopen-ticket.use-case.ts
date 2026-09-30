import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import {
  type LifecycleDependencies,
  type LifecycleInput,
  validate,
} from './close-ticket.use-case.js';
import { TicketNotFoundError } from './get-ticket.use-case.js';
import { randomUUID } from 'node:crypto';
import { InvalidTicketTransitionError } from '../../domain/tickets/ticket-state-machine.js';
import { redactSensitiveData } from '../../domain/security/secret-redactor.js';

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
    let updated;
    try {
      updated = ticket.reopen();
    } catch (error) {
      if (error instanceof InvalidTicketTransitionError) {
        await this.audit.append({
          id: this.dependencies.nextId(),
          ticketId,
          type: 'TRANSITION_REJECTED',
          actorId: input.actorId,
          metadata: {
            result: 'REJECTED',
            from: ticket.status,
            to: 'REOPENED',
            reason: redactSensitiveData(input.reason).text,
          },
          createdAt: this.dependencies.now(),
        });
      }
      throw error;
    }
    const changedAt = this.dependencies.now();
    await this.tickets.save(updated);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId,
      type: 'TICKET_REOPENED',
      actorId: input.actorId,
      metadata: { reason: redactSensitiveData(input.reason).text },
      createdAt: changedAt,
    });
    return { ticketId, status: updated.status, changedAt };
  }
}
