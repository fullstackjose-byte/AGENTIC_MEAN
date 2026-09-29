import { randomUUID } from 'node:crypto';
import type { TicketStatus } from '../../domain/tickets/ticket-state-machine.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { RemediationRepository } from '../../domain/remediations/remediation.repository.js';
import type {
  Remediation,
  RemediationAction,
  RemediationRisk,
} from '../../domain/remediations/remediation.js';
import { TicketNotFoundError } from '../tickets/get-ticket.use-case.js';
import {
  NOOP_AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from '../../domain/audit/audit-event.repository.js';

export interface RemediationDependencies {
  nextId(): string;
  now(): Date;
}

export interface ProposeRemediationInput {
  action: RemediationAction;
  requestedBy: string;
}

export class ProhibitedRemediationError extends Error {}

export class ProposeRemediationUseCase {
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
    ticketId: string,
    input: ProposeRemediationInput,
  ): Promise<Remediation & { ticketStatus: TicketStatus }> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new TicketNotFoundError(ticketId);
    if (ticket.status !== 'IN_DIAGNOSIS') {
      throw new Error('Ticket must be in diagnosis');
    }
    if (!input.requestedBy.trim()) throw new Error('Requested by is required');

    const risk = riskFor(input.action);
    if (risk === 'PROHIBITED') {
      throw new ProhibitedRemediationError('Remediation action is prohibited');
    }
    const requiresApproval = risk === 'MEDIUM';
    const updatedTicket = ticket.proposeRemediation(requiresApproval);
    const now = this.dependencies.now();
    const remediation: Remediation = {
      id: this.dependencies.nextId(),
      ticketId,
      action: input.action,
      risk,
      status: requiresApproval ? 'PENDING_APPROVAL' : 'EXECUTED',
      verificationStatus: requiresApproval ? 'NOT_RUN' : 'PASSED',
      requestedBy: input.requestedBy,
      decidedBy: null,
      decisionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.remediations.save(remediation);
    await this.tickets.save(updatedTicket);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId,
      type: 'REMEDIATION_PROPOSED',
      actorId: input.requestedBy,
      metadata: {
        action: input.action,
        risk,
        remediationStatus: remediation.status,
        verificationStatus: remediation.verificationStatus,
        ticketStatus: updatedTicket.status,
      },
      createdAt: now,
    });
    return { ...remediation, ticketStatus: updatedTicket.status };
  }
}

function riskFor(action: RemediationAction): RemediationRisk {
  if (action === 'REFRESH_VPN_PROFILE') return 'LOW';
  if (action === 'RESET_VPN_CONFIGURATION') return 'MEDIUM';
  return 'PROHIBITED';
}
