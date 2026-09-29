import type { DiagnosticRun } from './diagnostic-run.js';

export const DIAGNOSTIC_RUN_REPOSITORY = Symbol('DIAGNOSTIC_RUN_REPOSITORY');

export interface DiagnosticRunRepository {
  save(run: DiagnosticRun): Promise<void>;
  findByTicketId(ticketId: string): Promise<DiagnosticRun[]>;
}
