import type { ClassificationRepository } from '../../domain/triage/classification.repository.js';
import {
  buildTicketCapabilities,
  type TicketCapabilities,
} from '../../domain/triage/ticket-capabilities.js';

export class ClassificationNotFoundError extends Error {}

export class GetTicketCapabilitiesUseCase {
  constructor(private readonly classifications: ClassificationRepository) {}

  async execute(ticketId: string): Promise<TicketCapabilities> {
    const latest = (await this.classifications.findByTicketId(ticketId))[0];
    if (!latest) {
      throw new ClassificationNotFoundError(
        `No classification found for ticket ${ticketId}`,
      );
    }
    return buildTicketCapabilities(latest);
  }
}
