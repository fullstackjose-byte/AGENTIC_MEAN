import type { DiagnosticRunRepository } from '../../domain/diagnostics/diagnostic-run.repository.js';
import type {
  DiagnosticOutcome,
  DiagnosticRecommendation,
  DiagnosticRun,
} from '../../domain/diagnostics/diagnostic-run.js';
import type {
  OperatingSystem,
  VpnDiagnosticResult,
} from '../../application/ports/vpn-diagnostic.port.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaDiagnosticRunRepository
  implements DiagnosticRunRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async save(run: DiagnosticRun): Promise<void> {
    await this.prisma.diagnosticRun.create({ data: run });
  }

  async findByTicketId(ticketId: string): Promise<DiagnosticRun[]> {
    const records = await this.prisma.diagnosticRun.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      ...record,
      operatingSystem: record.operatingSystem as OperatingSystem,
      errorCode: record.errorCode as VpnDiagnosticResult['errorCode'],
      outcome: record.outcome as DiagnosticOutcome,
      recommendation: record.recommendation as DiagnosticRecommendation,
    }));
  }
}
