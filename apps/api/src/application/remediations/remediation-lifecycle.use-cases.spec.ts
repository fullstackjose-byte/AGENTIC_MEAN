import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import type { Remediation } from '../../domain/remediations/remediation.js';
import { InMemoryRemediationRepository } from '../../infrastructure/persistence/in-memory-remediation.repository.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { ApproveRemediationUseCase } from './approve-remediation.use-case.js';
import { ProposeRemediationUseCase } from './propose-remediation.use-case.js';
import { ResolveTicketUseCase } from './resolve-ticket.use-case.js';

const ticket = (status: 'IN_DIAGNOSIS' | 'PENDING_APPROVAL' | 'IN_REMEDIATION') =>
  Ticket.restore({
    id: '11111111-1111-4111-8111-111111111111',
    number: 'TCK-2026-000001',
    subject: 'VPN no conecta',
    description: 'El cliente no establece el tunel',
    requesterId: 'user-123',
    createdAt: new Date('2026-09-29T15:00:00.000Z'),
    containsRedactedData: false,
    status,
    priority: 'P3',
  });

const dependencies = {
  nextId: () => '22222222-2222-4222-8222-222222222222',
  now: () => new Date('2026-09-29T18:00:00.000Z'),
};

const pendingRemediation = (): Remediation => ({
  id: '22222222-2222-4222-8222-222222222222',
  ticketId: ticket('PENDING_APPROVAL').id,
  action: 'RESET_VPN_CONFIGURATION',
  risk: 'MEDIUM',
  status: 'PENDING_APPROVAL',
  verificationStatus: 'NOT_RUN',
  requestedBy: 'diagnostic-agent',
  decidedBy: null,
  decisionReason: null,
  createdAt: new Date('2026-09-29T18:00:00.000Z'),
  updatedAt: new Date('2026-09-29T18:00:00.000Z'),
});

describe('remediation lifecycle', () => {
  it('executes and verifies an allowlisted low-risk action automatically', async () => {
    const tickets = new InMemoryTicketRepository([ticket('IN_DIAGNOSIS')]);
    const remediations = new InMemoryRemediationRepository();
    const useCase = new ProposeRemediationUseCase(
      tickets,
      remediations,
      dependencies,
    );

    await expect(
      useCase.execute(ticket('IN_DIAGNOSIS').id, {
        action: 'REFRESH_VPN_PROFILE',
        requestedBy: 'diagnostic-agent',
      }),
    ).resolves.toMatchObject({
      risk: 'LOW',
      status: 'EXECUTED',
      verificationStatus: 'PASSED',
      ticketStatus: 'IN_REMEDIATION',
    });
  });

  it('requires human approval for a medium-risk action', async () => {
    const tickets = new InMemoryTicketRepository([ticket('IN_DIAGNOSIS')]);
    const useCase = new ProposeRemediationUseCase(
      tickets,
      new InMemoryRemediationRepository(),
      dependencies,
    );

    await expect(
      useCase.execute(ticket('IN_DIAGNOSIS').id, {
        action: 'RESET_VPN_CONFIGURATION',
        requestedBy: 'diagnostic-agent',
      }),
    ).resolves.toMatchObject({
      risk: 'MEDIUM',
      status: 'PENDING_APPROVAL',
      verificationStatus: 'NOT_RUN',
      ticketStatus: 'PENDING_APPROVAL',
    });
  });

  it('rejects an action outside the allowlist', async () => {
    const useCase = new ProposeRemediationUseCase(
      new InMemoryTicketRepository([ticket('IN_DIAGNOSIS')]),
      new InMemoryRemediationRepository(),
      dependencies,
    );

    await expect(
      useCase.execute(ticket('IN_DIAGNOSIS').id, {
        action: 'DISABLE_SECURITY_CONTROLS',
        requestedBy: 'diagnostic-agent',
      }),
    ).rejects.toThrow('Remediation action is prohibited');
  });

  it('records approval and executes the medium-risk action', async () => {
    const tickets = new InMemoryTicketRepository([ticket('PENDING_APPROVAL')]);
    const remediations = new InMemoryRemediationRepository([
      pendingRemediation(),
    ]);
    const useCase = new ApproveRemediationUseCase(
      tickets,
      remediations,
      dependencies,
    );

    await expect(
      useCase.execute(pendingRemediation().id, {
        approved: true,
        actorId: 'approver-1',
        reason: 'Cambio autorizado',
      }),
    ).resolves.toMatchObject({
      status: 'EXECUTED',
      verificationStatus: 'PASSED',
      decidedBy: 'approver-1',
      ticketStatus: 'IN_REMEDIATION',
    });
  });

  it('escalates the ticket when approval is rejected', async () => {
    const tickets = new InMemoryTicketRepository([ticket('PENDING_APPROVAL')]);
    const remediations = new InMemoryRemediationRepository([
      pendingRemediation(),
    ]);
    const useCase = new ApproveRemediationUseCase(
      tickets,
      remediations,
      dependencies,
    );

    await expect(
      useCase.execute(pendingRemediation().id, {
        approved: false,
        actorId: 'approver-1',
        reason: 'Riesgo no aceptado',
      }),
    ).resolves.toMatchObject({
      status: 'REJECTED',
      ticketStatus: 'ESCALATED',
    });
  });

  it('resolves only after successful verification', async () => {
    const executed = {
      ...pendingRemediation(),
      status: 'EXECUTED' as const,
      verificationStatus: 'PASSED' as const,
    };
    const useCase = new ResolveTicketUseCase(
      new InMemoryTicketRepository([ticket('IN_REMEDIATION')]),
      new InMemoryRemediationRepository([executed]),
      dependencies,
    );

    await expect(
      useCase.execute(ticket('IN_REMEDIATION').id, {
        resolutionSummary: 'Perfil VPN actualizado y conectividad verificada',
      }),
    ).resolves.toMatchObject({ status: 'RESOLVED' });
  });
});
