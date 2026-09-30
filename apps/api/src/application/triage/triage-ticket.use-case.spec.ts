import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { InMemoryClassificationRepository } from '../../infrastructure/persistence/in-memory-classification.repository.js';
import type {
  LanguageModelPort,
  TriageModelOutput,
} from '../ports/language-model.port.js';
import { TriageTicketUseCase } from './triage-ticket.use-case.js';
import { InMemoryAuditEventRepository } from '../../infrastructure/persistence/in-memory-audit-event.repository.js';

class FakeLanguageModel implements LanguageModelPort {
  constructor(private readonly output: TriageModelOutput) {}

  async classifyTicket(): Promise<TriageModelOutput> {
    return this.output;
  }
}

class FailingLanguageModel implements LanguageModelPort {
  classifyTicket(): Promise<TriageModelOutput> {
    return Promise.reject(
      new Error('raw provider failure with ana@example.com'),
    );
  }
}

function newTicket(description = 'La VPN falla desde esta mañana') {
  return Ticket.create({
    id: '11111111-1111-4111-8111-111111111111',
    number: 'TCK-2026-000001',
    subject: 'Problema de conexión',
    description,
    requesterId: 'user-123',
    createdAt: new Date('2026-09-29T15:00:00.000Z'),
    containsRedactedData: false,
  });
}

const dependencies = {
  nextId: () => 'classification-1',
  now: () => new Date('2026-09-29T16:00:00.000Z'),
};

describe('TriageTicketUseCase', () => {
  it('classifies a supported VPN ticket and hands it to diagnosis', async () => {
    const ticketRepository = new InMemoryTicketRepository([newTicket()]);
    const classificationRepository = new InMemoryClassificationRepository();
    const model = new FakeLanguageModel({
      category: 'INFRASTRUCTURE_SOFTWARE',
      subcategory: 'VPN',
      impact: 'SINGLE_USER',
      urgency: 'MEDIUM',
      confidence: 0.94,
      entities: {
        affectedUser: 'user-123',
        impactedService: 'corporate-vpn',
        businessCriticality: 'MEDIUM',
      },
      missingInformation: [],
    });
    const useCase = new TriageTicketUseCase(
      ticketRepository,
      classificationRepository,
      model,
      dependencies,
    );

    const result = await useCase.execute(newTicket().id);

    expect(result).toMatchObject({
      priority: 'P3',
      nextAction: 'HANDOFF_DIAGNOSTIC',
      ticketStatus: 'CLASSIFIED',
    });
    await expect(
      classificationRepository.findByTicketId(newTicket().id),
    ).resolves.toHaveLength(1);
    await expect(
      ticketRepository.findById(newTicket().id),
    ).resolves.toMatchObject({
      status: 'CLASSIFIED',
      priority: 'P3',
    });
  });

  it('escalates an uncertain classification to a human', async () => {
    const ticketRepository = new InMemoryTicketRepository([newTicket()]);
    const useCase = new TriageTicketUseCase(
      ticketRepository,
      new InMemoryClassificationRepository(),
      new FakeLanguageModel({
        category: 'OTHER',
        subcategory: 'UNKNOWN',
        impact: 'SINGLE_USER',
        urgency: 'LOW',
        confidence: 0.41,
        entities: {},
        missingInformation: ['service'],
      }),
      dependencies,
    );

    await expect(useCase.execute(newTicket().id)).resolves.toMatchObject({
      nextAction: 'ESCALATE_HUMAN',
      reason: 'LOW_CONFIDENCE_OR_UNSUPPORTED',
      ticketStatus: 'ESCALATED',
    });
  });

  it('escalates P1 even when the model confidence is high', async () => {
    const ticketRepository = new InMemoryTicketRepository([
      newTicket('La VPN está caída para toda la empresa'),
    ]);
    const useCase = new TriageTicketUseCase(
      ticketRepository,
      new InMemoryClassificationRepository(),
      new FakeLanguageModel({
        category: 'INFRASTRUCTURE_SOFTWARE',
        subcategory: 'VPN',
        impact: 'WIDESPREAD',
        urgency: 'HIGH',
        confidence: 0.98,
        entities: {
          affectedUser: 'user-123',
          impactedService: 'corporate-vpn',
          businessCriticality: 'HIGH',
        },
        missingInformation: [],
      }),
      dependencies,
    );

    await expect(useCase.execute(newTicket().id)).resolves.toMatchObject({
      priority: 'P1',
      nextAction: 'ESCALATE_HUMAN',
      reason: 'CRITICAL_PRIORITY',
      ticketStatus: 'ESCALATED',
    });
  });

  it.each(['ACCESS_IDENTITY', 'PROVISIONING_PERMISSIONS'] as const)(
    'escalates %s to a human when no safe automated diagnostic exists',
    async (category) => {
      const ticketRepository = new InMemoryTicketRepository([newTicket()]);
      const useCase = new TriageTicketUseCase(
        ticketRepository,
        new InMemoryClassificationRepository(),
        new FakeLanguageModel({
          category,
          subcategory: 'SUPPORTED_BUT_MANUAL',
          impact: 'SINGLE_USER',
          urgency: 'MEDIUM',
          confidence: 0.94,
          entities: {
            affectedUser: 'user-123',
            impactedService: 'identity-or-access',
            businessCriticality: 'MEDIUM',
          },
          missingInformation: [],
        }),
        dependencies,
      );
      await expect(useCase.execute(newTicket().id)).resolves.toMatchObject({
        nextAction: 'ESCALATE_HUMAN',
        reason: 'NO_AUTOMATED_DIAGNOSTIC',
        ticketStatus: 'ESCALATED',
      });
    },
  );

  it('canonicalizes affectedUser and sanitizes model-provided text', async () => {
    const useCase = new TriageTicketUseCase(
      new InMemoryTicketRepository([newTicket()]),
      new InMemoryClassificationRepository(),
      new FakeLanguageModel({
        category: 'INFRASTRUCTURE_SOFTWARE',
        subcategory: 'VPN ana@example.com',
        impact: 'SINGLE_USER',
        urgency: 'MEDIUM',
        confidence: 0.94,
        entities: {
          affectedUser: 'ana@example.com',
          impactedService: 'VPN 10.0.0.8',
          businessCriticality: 'MEDIUM',
        },
        missingInformation: [],
      }),
      dependencies,
    );
    const result = await useCase.execute(newTicket().id);
    expect(result.entities.affectedUser).toBe('user-123');
    expect(JSON.stringify(result)).not.toContain('ana@example.com');
    expect(result.entities.impactedService).toContain('[PRIVATE_IP_REDACTED]');
  });

  it('safely escalates provider failures with fixed sanitized evidence', async () => {
    const audit = new InMemoryAuditEventRepository();
    const useCase = new TriageTicketUseCase(
      new InMemoryTicketRepository([newTicket()]),
      new InMemoryClassificationRepository(),
      new FailingLanguageModel(),
      dependencies,
      audit,
    );
    await expect(useCase.execute(newTicket().id)).resolves.toMatchObject({
      category: 'OTHER',
      confidence: 0,
      ticketStatus: 'ESCALATED',
    });
    const events = await audit.findByTicketId(newTicket().id);
    expect(events[0]).toMatchObject({
      type: 'MODEL_CLASSIFICATION_FAILED',
      metadata: { reason: 'INVALID_OR_UNAVAILABLE_MODEL_OUTPUT' },
    });
    expect(JSON.stringify(events)).not.toContain('ana@example.com');
  });
});
