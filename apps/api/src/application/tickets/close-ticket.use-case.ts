import { randomUUID } from 'node:crypto';
import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import { TicketNotFoundError } from './get-ticket.use-case.js';
import { InvalidTicketTransitionError } from '../../domain/tickets/ticket-state-machine.js';
import { redactSensitiveData } from '../../domain/security/secret-redactor.js';

export interface LifecycleDependencies {
  nextId(): string;
  now(): Date;
}

export interface LifecycleInput {
  actorId: string;
  reason: string;
}

export class CloseTicketUseCase {
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
      updated = ticket.close();
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
            to: 'CLOSED',
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
      type: 'TICKET_CLOSED',
      actorId: input.actorId,
      metadata: { reason: redactSensitiveData(input.reason).text },
      createdAt: changedAt,
    });
    return { ticketId, status: updated.status, changedAt };
  }
}

export function validate(input: LifecycleInput): void {
  if (!input.actorId.trim() || !input.reason.trim()) {
    throw new Error('Actor and reason are required');
  }
}
