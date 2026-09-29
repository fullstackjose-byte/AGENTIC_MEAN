import type { Prisma } from '../../generated/prisma/client.js';
import type { AuditEventRepository } from '../../domain/audit/audit-event.repository.js';
import type { AuditEvent, AuditEventType } from '../../domain/audit/audit-event.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(event: AuditEvent): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        ...event,
        metadata: event.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findByTicketId(ticketId: string): Promise<AuditEvent[]> {
    const records = await this.prisma.auditEvent.findMany({
      where: { ticketId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map((record) => ({
      ...record,
      type: record.type as AuditEventType,
      metadata: record.metadata as AuditEvent['metadata'],
    }));
  }
}
