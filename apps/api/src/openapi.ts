import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Help Desk Agents API')
    .setDescription(
      'API para crear, clasificar y diagnosticar tickets de soporte en modo seguro.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Desarrollo local')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-User-Id' },
      'user-id',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-User-Role' },
      'user-role',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Correlation-Id',
        description: 'Identificador opcional de trazabilidad (se genera si se omite).',
      },
      'correlation-id',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token OIDC cuando AUTH_MODE=oidc.',
      },
      'oidc-bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ProblemDetails = {
    type: 'object',
    required: ['type', 'title', 'status', 'detail', 'instance', 'correlationId', 'timestamp'],
    properties: {
      type: { type: 'string', format: 'uri' },
      title: { type: 'string' },
      status: { type: 'integer', format: 'int32' },
      detail: { type: 'string' },
      instance: { type: 'string' },
      correlationId: { type: 'string', nullable: true },
      timestamp: { type: 'string', format: 'date-time' },
    },
  };
  for (const [route, path] of Object.entries(document.paths)) {
    for (const operation of Object.values(path ?? {})) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
      if (route.startsWith('/api/v1/tickets') || route.startsWith('/api/v1/remediations')) {
        operation.security = [
          { 'user-id': [], 'user-role': [] },
          { 'oidc-bearer': [] },
        ];
      }
      operation.responses ??= {};
      for (const status of ['400', '401', '403', '404', '409', '500']) {
        operation.responses[status] ??= {
          description: 'Error en formato Problem Details',
          content: {
            'application/problem+json': {
              schema: { $ref: '#/components/schemas/ProblemDetails' },
            },
          },
        };
      }
    }
  }
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
