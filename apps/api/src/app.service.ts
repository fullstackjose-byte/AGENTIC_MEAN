import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './infrastructure/persistence/prisma.service.js';

@Injectable()
export class AppService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getHealth(): { status: 'ok'; service: 'helpdesk-api' } {
    return { status: 'ok', service: 'helpdesk-api' };
  }

  async getReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    checks: { database: 'up' | 'down' };
  }> {
    const databaseReady =
      process.env.NODE_ENV === 'test' || (await this.prisma.isReady());
    return {
      status: databaseReady ? 'ready' : 'not_ready',
      checks: { database: databaseReady ? 'up' : 'down' },
    };
  }
}
