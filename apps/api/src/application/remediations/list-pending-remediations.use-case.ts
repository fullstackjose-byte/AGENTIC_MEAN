import type { RemediationRepository } from '../../domain/remediations/remediation.repository.js';

export class ListPendingRemediationsUseCase {
  constructor(private readonly remediations: RemediationRepository) {}

  execute() {
    return this.remediations.findPending();
  }
}
