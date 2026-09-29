import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { RemediationRepository } from '../../domain/remediations/remediation.repository.js';
import type { RemediationDependencies } from './propose-remediation.use-case.js';
import { TicketNotFoundError } from '../tickets/get-ticket.use-case.js';
import { randomUUID } from 'node:crypto';
import {
  NOOP_AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from '../../domain/audit/audit-event.repository.js';
import { redactSecrets } from '../../domain/security/secret-redactor.js';

export class ResolveTicketUseCase {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly remediations: RemediationRepository,
    private readonly dependencies: RemediationDependencies = {
      nextId: randomUUID,
      now: () => new Date(),
    },
    private readonly audit: AuditEventRepository = NOOP_AUDIT_EVENT_REPOSITORY,
  ) {}

  async execute(ticketId: string, input: { resolutionSummary: string }) {
    if (!input.resolutionSummary.trim()) {
      throw new Error('Resolution summary is required');
    }
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new TicketNotFoundError(ticketId);
    const remediations = await this.remediations.findByTicketId(ticketId);
    const verified = remediations.some(
      (item) =>
        item.status === 'EXECUTED' && item.verificationStatus === 'PASSED',
    );
    if (!verified) throw new Error('Successful remediation verification is required');

    const safeSummary = redactSecrets(input.resolutionSummary).text;
    const updatedTicket = ticket.resolve();
    const resolvedAt = this.dependencies.now();
    await this.tickets.save(updatedTicket);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId,
      type: 'TICKET_RESOLVED',
      actorId: 'remediation-agent',
      metadata: { summary: safeSummary },
      createdAt: resolvedAt,
    });
    return {
      ticketId,
      status: updatedTicket.status,
      resolutionSummary: safeSummary,
      resolvedAt,
    };
  }
}
