import type { RemediationRepository } from '../../domain/remediations/remediation.repository.js';
import type { Remediation } from '../../domain/remediations/remediation.js';

export class InMemoryRemediationRepository implements RemediationRepository {
  private readonly records = new Map<string, Remediation>();

  constructor(initial: Remediation[] = []) {
    initial.forEach((item) => this.records.set(item.id, item));
  }

  save(remediation: Remediation): Promise<void> {
    this.records.set(remediation.id, remediation);
    return Promise.resolve();
  }

  findById(id: string): Promise<Remediation | null> {
    return Promise.resolve(this.records.get(id) ?? null);
  }

  findByTicketId(ticketId: string): Promise<Remediation[]> {
    return Promise.resolve(
      [...this.records.values()].filter((item) => item.ticketId === ticketId),
    );
  }

  findPending(): Promise<Remediation[]> {
    return Promise.resolve(
      [...this.records.values()].filter(
        (item) => item.status === 'PENDING_APPROVAL',
      ),
    );
  }
}
