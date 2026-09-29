import { randomUUID } from 'node:crypto';
import { redactSecrets } from '../../domain/security/secret-redactor.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import { Ticket } from '../../domain/tickets/ticket.js';
import {
  NOOP_AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from '../../domain/audit/audit-event.repository.js';

export interface CreateTicketInput {
  subject: string;
  description: string;
  requesterId: string;
}

export interface TicketCreationDependencies {
  nextId(): string;
  nextTicketNumber(): string;
  now(): Date;
}

const defaultDependencies: TicketCreationDependencies = {
  nextId: () => randomUUID(),
  nextTicketNumber: () => {
    const year = new Date().getUTCFullYear();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    return `TCK-${year}-${suffix}`;
  },
  now: () => new Date(),
};

export class CreateTicketUseCase {
  constructor(
    private readonly repository: TicketRepository,
    private readonly dependencies: TicketCreationDependencies = defaultDependencies,
    private readonly audit: AuditEventRepository = NOOP_AUDIT_EVENT_REPOSITORY,
  ) {}

  async execute(input: CreateTicketInput): Promise<Ticket> {
    const subject = input.subject.trim();
    const description = input.description.trim();
    const requesterId = input.requesterId.trim();
    if (!subject || !description || !requesterId) {
      throw new Error('subject, description and requesterId are required');
    }

    const redacted = redactSecrets(description);
    const ticket = Ticket.create({
      id: this.dependencies.nextId(),
      number: this.dependencies.nextTicketNumber(),
      subject,
      description: redacted.text,
      requesterId,
      createdAt: this.dependencies.now(),
      containsRedactedData: redacted.redactionCount > 0,
    });
    await this.repository.save(ticket);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId: ticket.id,
      type: 'TICKET_CREATED',
      actorId: requesterId,
      metadata: {
        number: ticket.number,
        containsRedactedData: ticket.containsRedactedData,
      },
      createdAt: ticket.createdAt,
    });
    return ticket;
  }
}
