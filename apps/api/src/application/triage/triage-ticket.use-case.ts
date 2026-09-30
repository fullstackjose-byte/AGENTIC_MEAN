import type { LanguageModelPort } from '../ports/language-model.port.js';
import type { ClassificationRepository } from '../../domain/triage/classification.repository.js';
import type {
  TicketClassification,
  TriageNextAction,
  TriageReason,
} from '../../domain/triage/ticket-classification.js';
import { calculatePriority } from '../../domain/tickets/priority-policy.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { TicketStatus } from '../../domain/tickets/ticket-state-machine.js';
import { TicketNotFoundError } from '../tickets/get-ticket.use-case.js';
import { randomUUID } from 'node:crypto';
import {
  NOOP_AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from '../../domain/audit/audit-event.repository.js';
import {
  buildTicketCapabilities,
  type TicketCapabilities,
} from '../../domain/triage/ticket-capabilities.js';
import type { TriageModelOutput } from '../ports/language-model.port.js';
import { redactSensitiveData } from '../../domain/security/secret-redactor.js';

export interface TriageDependencies {
  nextId(): string;
  now(): Date;
}

export interface TriageResult extends TicketClassification {
  ticketStatus: TicketStatus;
  capabilities: TicketCapabilities;
}

export class TriageTicketUseCase {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly classifications: ClassificationRepository,
    private readonly model: LanguageModelPort,
    private readonly dependencies: TriageDependencies = {
      nextId: randomUUID,
      now: () => new Date(),
    },
    private readonly audit: AuditEventRepository = NOOP_AUDIT_EVENT_REPOSITORY,
  ) {}

  async execute(ticketId: string): Promise<TriageResult> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new TicketNotFoundError(ticketId);

    let output: TriageModelOutput;
    let modelFailed = false;
    try {
      output = await this.model.classifyTicket(ticket);
      this.validateOutput(output);
      output = this.sanitizeOutput(output, ticket.requesterId);
    } catch {
      modelFailed = true;
      output = {
        category: 'OTHER',
        subcategory: 'UNDETERMINED',
        impact: 'SINGLE_USER',
        urgency: 'MEDIUM',
        confidence: 0,
        entities: { affectedUser: ticket.requesterId },
        missingInformation: ['impactedService', 'businessCriticality'],
      };
    }
    const priority = calculatePriority({
      impact: output.impact,
      urgency: output.urgency,
    });

    const vpnDiagnosticSupported =
      output.category === 'INFRASTRUCTURE_SOFTWARE' &&
      output.subcategory === 'VPN' &&
      output.confidence >= 0.8 &&
      output.missingInformation.length === 0;
    let nextAction: TriageNextAction = vpnDiagnosticSupported
      ? 'HANDOFF_DIAGNOSTIC'
      : 'ESCALATE_HUMAN';
    let reason: TriageReason = vpnDiagnosticSupported
      ? 'SUPPORTED_AND_COMPLETE'
      : 'NO_AUTOMATED_DIAGNOSTIC';
    if (priority === 'P1') {
      nextAction = 'ESCALATE_HUMAN';
      reason = 'CRITICAL_PRIORITY';
    } else if (
      output.confidence < 0.8 ||
      output.category === 'OTHER' ||
      output.missingInformation.length > 0
    ) {
      nextAction = 'ESCALATE_HUMAN';
      reason = 'LOW_CONFIDENCE_OR_UNSUPPORTED';
    }

    const classification: TicketClassification = {
      id: this.dependencies.nextId(),
      ticketId,
      ...output,
      priority,
      nextAction,
      reason,
      createdAt: this.dependencies.now(),
    };
    const updatedTicket = ticket.applyTriage(
      priority,
      nextAction === 'ESCALATE_HUMAN',
    );
    if (modelFailed) {
      await this.audit.append({
        id: this.dependencies.nextId(),
        ticketId,
        type: 'MODEL_CLASSIFICATION_FAILED',
        actorId: 'triage-agent',
        metadata: {
          result: 'SAFE_ESCALATION',
          reason: 'INVALID_OR_UNAVAILABLE_MODEL_OUTPUT',
        },
        createdAt: this.dependencies.now(),
      });
    }
    await this.classifications.save(classification);
    await this.tickets.save(updatedTicket);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId,
      type: 'TICKET_CLASSIFIED',
      actorId: 'triage-agent',
      metadata: {
        category: output.category,
        subcategory: output.subcategory,
        priority,
        nextAction,
        ticketStatus: updatedTicket.status,
        confidence: output.confidence,
      },
      createdAt: this.dependencies.now(),
    });
    return {
      ...classification,
      ticketStatus: updatedTicket.status,
      capabilities: buildTicketCapabilities(classification),
    };
  }

  private validateOutput(
    output: Awaited<ReturnType<LanguageModelPort['classifyTicket']>>,
  ): void {
    if (
      !Number.isFinite(output.confidence) ||
      output.confidence < 0 ||
      output.confidence > 1 ||
      !output.subcategory.trim() ||
      !Array.isArray(output.missingInformation) ||
      !output.entities ||
      typeof output.entities !== 'object' ||
      ![
        'ACCESS_IDENTITY',
        'INFRASTRUCTURE_SOFTWARE',
        'PROVISIONING_PERMISSIONS',
        'OTHER',
      ].includes(output.category) ||
      !['SINGLE_USER', 'MULTIPLE_USERS', 'WIDESPREAD'].includes(
        output.impact,
      ) ||
      !['LOW', 'MEDIUM', 'HIGH'].includes(output.urgency)
    ) {
      throw new Error('Invalid structured triage output');
    }
  }

  private sanitizeOutput(
    output: TriageModelOutput,
    requesterId: string,
  ): TriageModelOutput {
    return {
      ...output,
      subcategory: redactSensitiveData(output.subcategory).text,
      entities: {
        affectedUser: requesterId,
        ...(output.entities.impactedService
          ? {
              impactedService: redactSensitiveData(
                output.entities.impactedService,
              ).text,
            }
          : {}),
        ...(output.entities.businessCriticality
          ? { businessCriticality: output.entities.businessCriticality }
          : {}),
      },
      missingInformation: output.missingInformation.map(
        (item) => redactSensitiveData(item).text,
      ),
    };
  }
}
