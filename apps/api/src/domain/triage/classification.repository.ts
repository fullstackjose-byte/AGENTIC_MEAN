import type { TicketClassification } from './ticket-classification.js';

export const CLASSIFICATION_REPOSITORY = Symbol('CLASSIFICATION_REPOSITORY');

export interface ClassificationRepository {
  save(classification: TicketClassification): Promise<void>;
  findByTicketId(ticketId: string): Promise<TicketClassification[]>;
}
