import type { Prisma } from '../../generated/prisma/client.js';
import type { TicketPriority as PrismaPriority } from '../../generated/prisma/enums.js';
import type { ClassificationRepository } from '../../domain/triage/classification.repository.js';
import type {
  TicketClassification,
  TriageNextAction,
  TriageReason,
} from '../../domain/triage/ticket-classification.js';
import type {
  SupportCategory,
  TriageImpact,
  TriageUrgency,
} from '../../application/ports/language-model.port.js';
import type { TicketPriority } from '../../domain/tickets/priority-policy.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaClassificationRepository
  implements ClassificationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async save(classification: TicketClassification): Promise<void> {
    await this.prisma.ticketClassification.create({
      data: {
        ...classification,
        priority: classification.priority as PrismaPriority,
        entities: classification.entities as Prisma.InputJsonValue,
        missingInformation:
          classification.missingInformation as Prisma.InputJsonValue,
      },
    });
  }

  async findByTicketId(ticketId: string): Promise<TicketClassification[]> {
    const records = await this.prisma.ticketClassification.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      ...record,
      category: record.category as SupportCategory,
      impact: record.impact as TriageImpact,
      urgency: record.urgency as TriageUrgency,
      priority: record.priority as TicketPriority,
      entities: record.entities as Record<string, string>,
      missingInformation: record.missingInformation as string[],
      nextAction: record.nextAction as TriageNextAction,
      reason: record.reason as TriageReason,
    }));
  }
}
