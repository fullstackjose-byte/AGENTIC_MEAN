import type { TicketStatus } from '../../domain/tickets/ticket-state-machine.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { RemediationRepository } from '../../domain/remediations/remediation.repository.js';
import type { Remediation } from '../../domain/remediations/remediation.js';
import type { RemediationDependencies } from './propose-remediation.use-case.js';
import { randomUUID } from 'node:crypto';
import {
  NOOP_AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from '../../domain/audit/audit-event.repository.js';

export interface ApprovalInput {
  approved: boolean;
  actorId: string;
  reason: string;
}

export class RemediationNotFoundError extends Error {}

export class ApproveRemediationUseCase {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly remediations: RemediationRepository,
    private readonly dependencies: RemediationDependencies = {
      nextId: randomUUID,
      now: () => new Date(),
    },
    private readonly audit: AuditEventRepository = NOOP_AUDIT_EVENT_REPOSITORY,
  ) {}

  async execute(
    remediationId: string,
    input: ApprovalInput,
  ): Promise<Remediation & { ticketStatus: TicketStatus }> {
    if (!input.actorId.trim() || !input.reason.trim()) {
      throw new Error('Approval actor and reason are required');
    }
    const remediation = await this.remediations.findById(remediationId);
    if (!remediation) throw new RemediationNotFoundError(remediationId);
    if (remediation.status !== 'PENDING_APPROVAL') {
      throw new Error('Remediation is not pending approval');
    }
    const ticket = await this.tickets.findById(remediation.ticketId);
    if (!ticket) throw new Error('Associated ticket was not found');

    const updatedTicket = ticket.decideRemediation(input.approved);
    const updated: Remediation = {
      ...remediation,
      status: input.approved ? 'EXECUTED' : 'REJECTED',
      verificationStatus: input.approved ? 'PASSED' : 'NOT_RUN',
      decidedBy: input.actorId,
      decisionReason: input.reason,
      updatedAt: this.dependencies.now(),
    };
    await this.remediations.save(updated);
    await this.tickets.save(updatedTicket);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId: remediation.ticketId,
      type: input.approved ? 'REMEDIATION_APPROVED' : 'REMEDIATION_REJECTED',
      actorId: input.actorId,
      metadata: {
        remediationId,
        reason: input.reason,
        ticketStatus: updatedTicket.status,
      },
      createdAt: updated.updatedAt,
    });
    return { ...updated, ticketStatus: updatedTicket.status };
  }
}
