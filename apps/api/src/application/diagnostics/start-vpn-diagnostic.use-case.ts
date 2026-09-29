import { randomUUID } from 'node:crypto';
import type { VpnDiagnosticPort, VpnDiagnosticInput } from '../ports/vpn-diagnostic.port.js';
import type { TicketRepository } from '../../domain/tickets/ticket.repository.js';
import type { ClassificationRepository } from '../../domain/triage/classification.repository.js';
import type { DiagnosticRunRepository } from '../../domain/diagnostics/diagnostic-run.repository.js';
import type {
  DiagnosticOutcome,
  DiagnosticRecommendation,
  DiagnosticResult,
} from '../../domain/diagnostics/diagnostic-run.js';
import { redactSecrets } from '../../domain/security/secret-redactor.js';
import { TicketNotFoundError } from '../tickets/get-ticket.use-case.js';
import {
  NOOP_AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from '../../domain/audit/audit-event.repository.js';

export interface DiagnosticDependencies {
  nextId(): string;
  now(): Date;
}

export class UnsupportedDiagnosticError extends Error {}

export class StartVpnDiagnosticUseCase {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly classifications: ClassificationRepository,
    private readonly runs: DiagnosticRunRepository,
    private readonly diagnostic: VpnDiagnosticPort,
    private readonly dependencies: DiagnosticDependencies = {
      nextId: randomUUID,
      now: () => new Date(),
    },
    private readonly audit: AuditEventRepository = NOOP_AUDIT_EVENT_REPOSITORY,
  ) {}

  async execute(
    ticketId: string,
    input: VpnDiagnosticInput,
  ): Promise<DiagnosticResult> {
    if (!['WINDOWS', 'MACOS', 'LINUX'].includes(input.operatingSystem)) {
      throw new Error('Unsupported operating system');
    }
    if (typeof input.errorMessage !== 'string' || !input.errorMessage.trim()) {
      throw new Error('Diagnostic error message is required');
    }
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new TicketNotFoundError(ticketId);
    if (!['CLASSIFIED', 'REOPENED'].includes(ticket.status)) {
      throw new UnsupportedDiagnosticError('Ticket must be classified first');
    }

    const classifications = await this.classifications.findByTicketId(ticketId);
    const latest = classifications.toSorted(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0];
    if (
      !latest ||
      latest.category !== 'INFRASTRUCTURE_SOFTWARE' ||
      latest.subcategory !== 'VPN' ||
      latest.confidence < 0.8 ||
      latest.missingInformation.length > 0
    ) {
      await this.audit.append({
        id: this.dependencies.nextId(),
        ticketId,
        type: 'DIAGNOSTIC_REJECTED',
        actorId: 'diagnostic-agent',
        metadata: {
          result: 'REJECTED',
          reason: 'INCOMPATIBLE_OR_INCOMPLETE_CLASSIFICATION',
        },
        createdAt: this.dependencies.now(),
      });
      throw new UnsupportedDiagnosticError(
        'A VPN classification with confidence >= 0.80 is required',
      );
    }

    const safeError = redactSecrets(input.errorMessage).text;
    const evidence = await this.diagnostic.check({
      ...input,
      errorMessage: safeError,
    });
    const decision = decide(evidence);
    const updatedTicket = ticket.startDiagnosis(decision.escalate);
    const run = {
      id: this.dependencies.nextId(),
      ticketId,
      operatingSystem: input.operatingSystem,
      errorMessage: safeError,
      ...evidence,
      outcome: decision.outcome,
      recommendation: decision.recommendation,
      createdAt: this.dependencies.now(),
    };
    await this.runs.save(run);
    await this.tickets.save(updatedTicket);
    await this.audit.append({
      id: this.dependencies.nextId(),
      ticketId,
      type: 'DIAGNOSTIC_COMPLETED',
      actorId: 'diagnostic-agent',
      metadata: {
        outcome: decision.outcome,
        recommendation: decision.recommendation,
        dnsResolved: evidence.dnsResolved,
        tcpReachable: evidence.tcpReachable,
        errorCode: evidence.errorCode,
        ticketStatus: updatedTicket.status,
      },
      createdAt: this.dependencies.now(),
    });
    return { ...run, ticketStatus: updatedTicket.status };
  }
}

function decide(evidence: Awaited<ReturnType<VpnDiagnosticPort['check']>>): {
  outcome: DiagnosticOutcome;
  recommendation: DiagnosticRecommendation;
  escalate: boolean;
} {
  if (evidence.errorCode === 'TOOL_UNAVAILABLE') {
    return {
      outcome: 'INCONCLUSIVE',
      recommendation: 'ESCALATE_HUMAN',
      escalate: true,
    };
  }
  if (!evidence.dnsResolved) {
    return {
      outcome: 'DNS_FAILURE',
      recommendation: 'CHECK_DNS_CONFIGURATION',
      escalate: false,
    };
  }
  if (!evidence.tcpReachable) {
    return {
      outcome: 'ENDPOINT_UNREACHABLE',
      recommendation: 'VERIFY_NETWORK_OR_SERVICE',
      escalate: false,
    };
  }
  return {
    outcome: 'CONNECTIVITY_OK',
    recommendation: 'VERIFY_CLIENT_CONFIGURATION',
    escalate: false,
  };
}
