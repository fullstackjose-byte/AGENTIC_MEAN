import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TicketsModule } from './tickets.module.js';
import { APP_GUARD } from '@nestjs/core';
import { RoleAuthorizationGuard } from './interfaces/auth/role-authorization.guard.js';
import { CorrelationIdMiddleware } from './infrastructure/observability/correlation-id.middleware.js';
import { ObservabilityModule } from './infrastructure/observability/observability.module.js';
import { TOKEN_VERIFIER } from './application/ports/token-verifier.port.js';
import { oidcVerifierFromEnvironment } from './infrastructure/auth/oidc-token-verifier.js';

@Module({
  imports: [ObservabilityModule, TicketsModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: TOKEN_VERIFIER,
      useFactory: () => oidcVerifierFromEnvironment(),
    },
    { provide: APP_GUARD, useClass: RoleAuthorizationGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
