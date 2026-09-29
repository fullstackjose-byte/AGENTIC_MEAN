import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import { InMemoryClassificationRepository } from '../../infrastructure/persistence/in-memory-classification.repository.js';
import type {
  LanguageModelPort,
  TriageModelOutput,
} from '../ports/language-model.port.js';
import { TriageTicketUseCase } from './triage-ticket.use-case.js';

class FakeLanguageModel implements LanguageModelPort {
  constructor(private readonly output: TriageModelOutput) {}

  async classifyTicket(): Promise<TriageModelOutput> {
    return this.output;
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
    await expect(classificationRepository.findByTicketId(newTicket().id)).resolves.toHaveLength(1);
    await expect(ticketRepository.findById(newTicket().id)).resolves.toMatchObject({
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
    const ticketRepository = new InMemoryTicketRepository([newTicket('La VPN está caída para toda la empresa')]);
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
});
