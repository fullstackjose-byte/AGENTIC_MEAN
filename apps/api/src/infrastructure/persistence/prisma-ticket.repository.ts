import type { TicketPriority as PrismaPriority, TicketStatus as PrismaStatus } from '../../generated/prisma/enums.js';
import type {
  TicketPage,
  TicketPageCriteria,
  TicketRepository,
} from '../../domain/tickets/ticket.repository.js';
import { Ticket } from '../../domain/tickets/ticket.js';
import type { TicketPriority } from '../../domain/tickets/priority-policy.js';
import type { TicketStatus } from '../../domain/tickets/ticket-state-machine.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(ticket: Ticket): Promise<void> {
    await this.prisma.ticket.upsert({
      where: { id: ticket.id },
      create: {
        id: ticket.id,
        number: ticket.number,
        subject: ticket.subject,
        description: ticket.description,
        requesterId: ticket.requesterId,
        status: ticket.status as PrismaStatus,
        priority: ticket.priority as PrismaPriority,
        containsRedactedData: ticket.containsRedactedData,
        createdAt: ticket.createdAt,
      },
      update: {
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status as PrismaStatus,
        priority: ticket.priority as PrismaPriority,
        containsRedactedData: ticket.containsRedactedData,
      },
    });
  }

  async findById(id: string): Promise<Ticket | null> {
    const record = await this.prisma.ticket.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findPage(criteria: TicketPageCriteria): Promise<TicketPage> {
    const records = await this.prisma.ticket.findMany({
      where: {
        status: criteria.status as PrismaStatus | undefined,
        priority: criteria.priority as PrismaPriority | undefined,
        requesterId: criteria.requesterId,
        OR: criteria.search
          ? [
              { subject: { contains: criteria.search, mode: 'insensitive' } },
              { number: { contains: criteria.search, mode: 'insensitive' } },
            ]
          : undefined,
        AND: criteria.after
          ? [
              {
                OR: [
                  { createdAt: { lt: criteria.after.createdAt } },
                  {
                    createdAt: criteria.after.createdAt,
                    id: { lt: criteria.after.id },
                  },
                ],
              },
            ]
          : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: criteria.limit + 1,
    });
    return {
      items: records
        .slice(0, criteria.limit)
        .map((record) => this.toDomain(record)),
      hasNextPage: records.length > criteria.limit,
    };
  }

  private toDomain(record: {
    id: string;
    number: string;
    subject: string;
    description: string;
    requesterId: string;
    status: PrismaStatus;
    priority: PrismaPriority;
    containsRedactedData: boolean;
    createdAt: Date;
  }): Ticket {
    return Ticket.restore({
      ...record,
      status: record.status as TicketStatus,
      priority: record.priority as TicketPriority,
    });
  }
}
