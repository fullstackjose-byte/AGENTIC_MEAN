import type { DiagnosticRunRepository } from '../../domain/diagnostics/diagnostic-run.repository.js';
import type { DiagnosticRun } from '../../domain/diagnostics/diagnostic-run.js';

export class InMemoryDiagnosticRunRepository
  implements DiagnosticRunRepository
{
  private readonly runs: DiagnosticRun[] = [];

  save(run: DiagnosticRun): Promise<void> {
    this.runs.push(run);
    return Promise.resolve();
  }

  findByTicketId(ticketId: string): Promise<DiagnosticRun[]> {
    return Promise.resolve(this.runs.filter((run) => run.ticketId === ticketId));
  }
}
