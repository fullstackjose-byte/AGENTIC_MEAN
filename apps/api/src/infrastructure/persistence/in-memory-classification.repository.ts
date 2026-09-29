import type { ClassificationRepository } from '../../domain/triage/classification.repository.js';
import type { TicketClassification } from '../../domain/triage/ticket-classification.js';

export class InMemoryClassificationRepository
  implements ClassificationRepository
{
  private readonly classifications: TicketClassification[] = [];

  async save(classification: TicketClassification): Promise<void> {
    this.classifications.push(classification);
  }

  async findByTicketId(ticketId: string): Promise<TicketClassification[]> {
    return this.classifications.filter((item) => item.ticketId === ticketId);
  }
}
