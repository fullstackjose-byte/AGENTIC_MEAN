import type { RemediationRepository } from '../../domain/remediations/remediation.repository.js';
import type {
  Remediation,
  RemediationAction,
  RemediationRisk,
  RemediationStatus,
  VerificationStatus,
} from '../../domain/remediations/remediation.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaRemediationRepository implements RemediationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(remediation: Remediation): Promise<void> {
    await this.prisma.remediation.upsert({
      where: { id: remediation.id },
      create: remediation,
      update: {
        status: remediation.status,
        verificationStatus: remediation.verificationStatus,
        decidedBy: remediation.decidedBy,
        decisionReason: remediation.decisionReason,
        updatedAt: remediation.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Remediation | null> {
    const record = await this.prisma.remediation.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByTicketId(ticketId: string): Promise<Remediation[]> {
    const records = await this.prisma.remediation.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.toDomain(record));
  }

  async findPending(): Promise<Remediation[]> {
    const records = await this.prisma.remediation.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((record) => this.toDomain(record));
  }

  private toDomain(record: {
    id: string;
    ticketId: string;
    action: string;
    risk: string;
    status: string;
    verificationStatus: string;
    requestedBy: string;
    decidedBy: string | null;
    decisionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Remediation {
    return {
      ...record,
      action: record.action as RemediationAction,
      risk: record.risk as RemediationRisk,
      status: record.status as RemediationStatus,
      verificationStatus: record.verificationStatus as VerificationStatus,
    };
  }
}
