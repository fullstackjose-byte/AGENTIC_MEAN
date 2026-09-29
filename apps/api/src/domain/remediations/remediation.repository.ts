import type { Remediation } from './remediation.js';

export const REMEDIATION_REPOSITORY = Symbol('REMEDIATION_REPOSITORY');

export interface RemediationRepository {
  save(remediation: Remediation): Promise<void>;
  findById(id: string): Promise<Remediation | null>;
  findByTicketId(ticketId: string): Promise<Remediation[]>;
  findPending(): Promise<Remediation[]>;
}
