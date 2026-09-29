import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './interfaces/auth/auth.decorators.js';
import { MetricsService } from './infrastructure/observability/metrics.service.js';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    @Inject(AppService) private readonly appService: AppService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  @Get('api/v1/health')
  @Public()
  @ApiOperation({ summary: 'Consultar estado de la API' })
  getHealth(): { status: 'ok'; service: 'helpdesk-api' } {
    return this.appService.getHealth();
  }

  @Get('api/v1/ready')
  @Public()
  @ApiOperation({ summary: 'Comprobar disponibilidad de PostgreSQL' })
  async getReadiness() {
    const readiness = await this.appService.getReadiness();
    if (readiness.status === 'not_ready') {
      throw new ServiceUnavailableException(readiness);
    }
    return readiness;
  }

  @Get('api/v1/metrics')
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Consultar métricas en formato Prometheus' })
  getMetrics(): string {
    return this.metrics.render();
  }
}
