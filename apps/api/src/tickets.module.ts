import { Module } from '@nestjs/common';
import { CreateTicketUseCase } from './application/tickets/create-ticket.use-case.js';
import { GetTicketUseCase } from './application/tickets/get-ticket.use-case.js';
import { ListTicketsUseCase } from './application/tickets/list-tickets.use-case.js';
import {
  LANGUAGE_MODEL_PORT,
  type LanguageModelPort,
} from './application/ports/language-model.port.js';
import { TriageTicketUseCase } from './application/triage/triage-ticket.use-case.js';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from './domain/tickets/ticket.repository.js';
import { InMemoryTicketRepository } from './infrastructure/persistence/in-memory-ticket.repository.js';
import {
  CLASSIFICATION_REPOSITORY,
  type ClassificationRepository,
} from './domain/triage/classification.repository.js';
import { InMemoryClassificationRepository } from './infrastructure/persistence/in-memory-classification.repository.js';
import { PrismaClassificationRepository } from './infrastructure/persistence/prisma-classification.repository.js';
import { PrismaTicketRepository } from './infrastructure/persistence/prisma-ticket.repository.js';
import { PrismaService } from './infrastructure/persistence/prisma.service.js';
import { languageModelFromEnvironment } from './infrastructure/llm/language-model.factory.js';
import { TicketsController } from './interfaces/http/tickets.controller.js';
import {
  DIAGNOSTIC_RUN_REPOSITORY,
  type DiagnosticRunRepository,
} from './domain/diagnostics/diagnostic-run.repository.js';
import { InMemoryDiagnosticRunRepository } from './infrastructure/persistence/in-memory-diagnostic-run.repository.js';
import { PrismaDiagnosticRunRepository } from './infrastructure/persistence/prisma-diagnostic-run.repository.js';
import {
  VPN_DIAGNOSTIC_PORT,
  type VpnDiagnosticPort,
} from './application/ports/vpn-diagnostic.port.js';
import { MockVpnDiagnosticAdapter } from './infrastructure/diagnostics/mock-vpn-diagnostic.adapter.js';
import { StartVpnDiagnosticUseCase } from './application/diagnostics/start-vpn-diagnostic.use-case.js';
import {
  REMEDIATION_REPOSITORY,
  type RemediationRepository,
} from './domain/remediations/remediation.repository.js';
import { InMemoryRemediationRepository } from './infrastructure/persistence/in-memory-remediation.repository.js';
import { PrismaRemediationRepository } from './infrastructure/persistence/prisma-remediation.repository.js';
import { ProposeRemediationUseCase } from './application/remediations/propose-remediation.use-case.js';
import { ApproveRemediationUseCase } from './application/remediations/approve-remediation.use-case.js';
import { ResolveTicketUseCase } from './application/remediations/resolve-ticket.use-case.js';
import { ListPendingRemediationsUseCase } from './application/remediations/list-pending-remediations.use-case.js';
import { RemediationsController } from './interfaces/http/remediations.controller.js';
import {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from './domain/audit/audit-event.repository.js';
import { InMemoryAuditEventRepository } from './infrastructure/persistence/in-memory-audit-event.repository.js';
import { PrismaAuditEventRepository } from './infrastructure/persistence/prisma-audit-event.repository.js';
import { CloseTicketUseCase } from './application/tickets/close-ticket.use-case.js';
import { ReopenTicketUseCase } from './application/tickets/reopen-ticket.use-case.js';
import { GetTicketTimelineUseCase } from './application/tickets/get-ticket-timeline.use-case.js';
import { RequestContextService } from './infrastructure/observability/request-context.service.js';
import { CorrelatedAuditEventRepository } from './infrastructure/observability/correlated-audit-event.repository.js';
import { GetTicketCapabilitiesUseCase } from './application/triage/get-ticket-capabilities.use-case.js';

const AUDIT_EVENT_STORAGE = Symbol('AUDIT_EVENT_STORAGE');

@Module({
  controllers: [TicketsController, RemediationsController],
  providers: [
    PrismaService,
    {
      provide: TICKET_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): TicketRepository =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryTicketRepository()
          : new PrismaTicketRepository(prisma),
    },
    {
      provide: CLASSIFICATION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): ClassificationRepository =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryClassificationRepository()
          : new PrismaClassificationRepository(prisma),
    },
    {
      provide: LANGUAGE_MODEL_PORT,
      useFactory: (): LanguageModelPort => languageModelFromEnvironment(),
    },
    {
      provide: DIAGNOSTIC_RUN_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): DiagnosticRunRepository =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryDiagnosticRunRepository()
          : new PrismaDiagnosticRunRepository(prisma),
    },
    {
      provide: VPN_DIAGNOSTIC_PORT,
      useFactory: (): VpnDiagnosticPort => new MockVpnDiagnosticAdapter(),
    },
    {
      provide: REMEDIATION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): RemediationRepository =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryRemediationRepository()
          : new PrismaRemediationRepository(prisma),
    },
    {
      provide: AUDIT_EVENT_STORAGE,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): AuditEventRepository =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryAuditEventRepository()
          : new PrismaAuditEventRepository(prisma),
    },
    {
      provide: AUDIT_EVENT_REPOSITORY,
      inject: [AUDIT_EVENT_STORAGE, RequestContextService],
      useFactory: (
        repository: AuditEventRepository,
        context: RequestContextService,
      ): AuditEventRepository =>
        new CorrelatedAuditEventRepository(repository, context),
    },
    {
      provide: CreateTicketUseCase,
      inject: [TICKET_REPOSITORY, AUDIT_EVENT_REPOSITORY],
      useFactory: (repository: TicketRepository, audit: AuditEventRepository) =>
        new CreateTicketUseCase(repository, undefined, audit),
    },
    {
      provide: GetTicketUseCase,
      inject: [TICKET_REPOSITORY],
      useFactory: (repository: TicketRepository) =>
        new GetTicketUseCase(repository),
    },
    {
      provide: ListTicketsUseCase,
      inject: [TICKET_REPOSITORY],
      useFactory: (repository: TicketRepository) =>
        new ListTicketsUseCase(repository),
    },
    {
      provide: TriageTicketUseCase,
      inject: [
        TICKET_REPOSITORY,
        CLASSIFICATION_REPOSITORY,
        LANGUAGE_MODEL_PORT,
        AUDIT_EVENT_REPOSITORY,
      ],
      useFactory: (
        tickets: TicketRepository,
        classifications: ClassificationRepository,
        model: LanguageModelPort,
        audit: AuditEventRepository,
      ) =>
        new TriageTicketUseCase(
          tickets,
          classifications,
          model,
          undefined,
          audit,
        ),
    },
    {
      provide: GetTicketCapabilitiesUseCase,
      inject: [CLASSIFICATION_REPOSITORY],
      useFactory: (classifications: ClassificationRepository) =>
        new GetTicketCapabilitiesUseCase(classifications),
    },
    {
      provide: StartVpnDiagnosticUseCase,
      inject: [
        TICKET_REPOSITORY,
        CLASSIFICATION_REPOSITORY,
        DIAGNOSTIC_RUN_REPOSITORY,
        VPN_DIAGNOSTIC_PORT,
        AUDIT_EVENT_REPOSITORY,
      ],
      useFactory: (
        tickets: TicketRepository,
        classifications: ClassificationRepository,
        runs: DiagnosticRunRepository,
        diagnostic: VpnDiagnosticPort,
        audit: AuditEventRepository,
      ) =>
        new StartVpnDiagnosticUseCase(
          tickets,
          classifications,
          runs,
          diagnostic,
          undefined,
          audit,
        ),
    },
    {
      provide: ProposeRemediationUseCase,
      inject: [
        TICKET_REPOSITORY,
        REMEDIATION_REPOSITORY,
        AUDIT_EVENT_REPOSITORY,
      ],
      useFactory: (
        tickets: TicketRepository,
        remediations: RemediationRepository,
        audit: AuditEventRepository,
      ) =>
        new ProposeRemediationUseCase(tickets, remediations, undefined, audit),
    },
    {
      provide: ApproveRemediationUseCase,
      inject: [
        TICKET_REPOSITORY,
        REMEDIATION_REPOSITORY,
        AUDIT_EVENT_REPOSITORY,
      ],
      useFactory: (
        tickets: TicketRepository,
        remediations: RemediationRepository,
        audit: AuditEventRepository,
      ) =>
        new ApproveRemediationUseCase(tickets, remediations, undefined, audit),
    },
    {
      provide: ResolveTicketUseCase,
      inject: [
        TICKET_REPOSITORY,
        REMEDIATION_REPOSITORY,
        AUDIT_EVENT_REPOSITORY,
      ],
      useFactory: (
        tickets: TicketRepository,
        remediations: RemediationRepository,
        audit: AuditEventRepository,
      ) => new ResolveTicketUseCase(tickets, remediations, undefined, audit),
    },
    {
      provide: ListPendingRemediationsUseCase,
      inject: [REMEDIATION_REPOSITORY],
      useFactory: (remediations: RemediationRepository) =>
        new ListPendingRemediationsUseCase(remediations),
    },
    {
      provide: CloseTicketUseCase,
      inject: [TICKET_REPOSITORY, AUDIT_EVENT_REPOSITORY],
      useFactory: (tickets: TicketRepository, audit: AuditEventRepository) =>
        new CloseTicketUseCase(tickets, audit),
    },
    {
      provide: ReopenTicketUseCase,
      inject: [TICKET_REPOSITORY, AUDIT_EVENT_REPOSITORY],
      useFactory: (tickets: TicketRepository, audit: AuditEventRepository) =>
        new ReopenTicketUseCase(tickets, audit),
    },
    {
      provide: GetTicketTimelineUseCase,
      inject: [AUDIT_EVENT_REPOSITORY],
      useFactory: (audit: AuditEventRepository) =>
        new GetTicketTimelineUseCase(audit),
    },
  ],
  exports: [PrismaService],
})
export class TicketsModule {}
