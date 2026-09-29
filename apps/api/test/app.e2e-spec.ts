import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureOpenApi } from './../src/openapi.js';

interface HeaderRequest {
  set(field: string, value: string): this;
}

function asRole<T extends HeaderRequest>(
  call: T,
  role: 'END_USER' | 'SUPPORT_AGENT' | 'APPROVER' | 'ADMIN' | 'AUDITOR',
  userId: string,
): T {
  return call.set('X-User-Id', userId).set('X-User-Role', role);
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureOpenApi(app);
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok', service: 'helpdesk-api' });
  });

  it('propagates correlation IDs and exposes readiness and metrics', async () => {
    const correlationId = 'acceptance-flow-42';
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Correlation-Id', correlationId)
      .expect('X-Correlation-Id', correlationId)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/ready')
      .expect(200)
      .expect({ status: 'ready', checks: { database: 'up' } });

    const metrics = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .expect(200);
    expect(metrics.text).toContain('helpdesk_http_requests_total');
  });

  it('exposes interactive OpenAPI documentation', async () => {
    const specification = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(specification.body.paths).toHaveProperty('/api/v1/tickets');
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/tickets/{id}/diagnostics',
    );
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/tickets/{id}/remediations',
    );
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/remediations/{id}/approval',
    );
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/tickets/{id}/resolution',
    );
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/tickets/{id}/timeline',
    );
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/tickets/{id}/closure',
    );
    expect(specification.body.paths).toHaveProperty(
      '/api/v1/tickets/{id}/reopen',
    );
    expect(specification.body.components.securitySchemes).toHaveProperty(
      'user-id',
    );
    expect(specification.body.components.securitySchemes).toHaveProperty(
      'user-role',
    );
    expect(specification.body.components.securitySchemes).toHaveProperty(
      'correlation-id',
    );
    expect(specification.body.components.securitySchemes).toHaveProperty(
      'oidc-bearer',
    );
    expect(specification.body.paths['/api/v1/tickets'].get.security).toEqual([
      { 'user-id': [], 'user-role': [] },
      { 'oidc-bearer': [] },
    ]);
    expect(specification.body.components.schemas).toHaveProperty(
      'ProblemDetails',
    );
    expect(
      specification.body.paths['/api/v1/tickets'].get.responses['400'].content,
    ).toHaveProperty('application/problem+json');
  });

  it('enforces authentication and returns RFC Problem Details', async () => {
    const unauthorized = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('X-Correlation-Id', 'unauthorized-check')
      .expect('Content-Type', /application\/problem\+json/)
      .expect(401);
    expect(unauthorized.body).toMatchObject({
      title: 'Unauthorized',
      status: 401,
      instance: '/api/v1/tickets',
      correlationId: 'unauthorized-check',
    });
    await asRole(
      request(app.getHttpServer()).get('/api/v1/remediations/pending'),
      'SUPPORT_AGENT',
      'support-1',
    ).expect(403);
  });

  it('creates, lists and gets a ticket', async () => {
    const created = await asRole(
      request(app.getHttpServer()).post('/api/v1/tickets'),
      'END_USER',
      'user-123',
    )
      .set('X-Correlation-Id', 'ticket-creation-flow')
      .send({
        subject: 'VPN no conecta',
        description: 'La conexión falla desde esta mañana',
        requesterId: 'user-123',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      subject: 'VPN no conecta',
      status: 'NEW',
      priority: 'P4',
    });

    const listed = await asRole(
      request(app.getHttpServer()).get('/api/v1/tickets'),
      'END_USER',
      'user-123',
    )
      .expect(200);
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.pageInfo).toEqual({
      hasNextPage: false,
      nextCursor: null,
    });

    const invalidQuery = await asRole(
      request(app.getHttpServer()).get('/api/v1/tickets?limit=0'),
      'SUPPORT_AGENT',
      'support-1',
    ).expect(400);
    expect(invalidQuery.body).toMatchObject({
      status: 400,
      title: 'Bad Request',
      detail: 'limit must be an integer from 1 to 100',
    });

    const found = await asRole(
      request(app.getHttpServer()).get(`/api/v1/tickets/${created.body.id}`),
      'END_USER',
      'user-123',
    )
      .expect(200);
    expect(found.body.id).toBe(created.body.id);

    await asRole(
      request(app.getHttpServer()).get(`/api/v1/tickets/${created.body.id}`),
      'END_USER',
      'another-user',
    ).expect(403);

    const triage = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/classifications`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .expect(201);
    expect(triage.body).toMatchObject({
      ticketId: created.body.id,
      category: 'INFRASTRUCTURE_SOFTWARE',
      subcategory: 'VPN',
      priority: 'P3',
      nextAction: 'HANDOFF_DIAGNOSTIC',
      reason: 'SUPPORTED_AND_COMPLETE',
      ticketStatus: 'CLASSIFIED',
    });

    const diagnostic = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/diagnostics`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .send({
        operatingSystem: 'WINDOWS',
        errorMessage: 'El cliente muestra timeout',
      })
      .expect(201);
    expect(diagnostic.body).toMatchObject({
      ticketId: created.body.id,
      outcome: 'CONNECTIVITY_OK',
      recommendation: 'VERIFY_CLIENT_CONFIGURATION',
      ticketStatus: 'IN_DIAGNOSIS',
    });

    const remediation = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/remediations`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .send({
        action: 'REFRESH_VPN_PROFILE',
        requestedBy: 'diagnostic-agent',
      })
      .expect(201);
    expect(remediation.body).toMatchObject({
      risk: 'LOW',
      status: 'EXECUTED',
      verificationStatus: 'PASSED',
      ticketStatus: 'IN_REMEDIATION',
    });

    const resolution = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/resolution`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .send({ resolutionSummary: 'Perfil VPN actualizado y verificado' })
      .expect(201);
    expect(resolution.body).toMatchObject({
      ticketId: created.body.id,
      status: 'RESOLVED',
    });

    const timeline = await asRole(
      request(app.getHttpServer()).get(
        `/api/v1/tickets/${created.body.id}/timeline`,
      ),
      'AUDITOR',
      'auditor-1',
    )
      .expect(200);
    expect(timeline.body.map((event: { type: string }) => event.type)).toEqual([
      'TICKET_CREATED',
      'TICKET_CLASSIFIED',
      'DIAGNOSTIC_COMPLETED',
      'REMEDIATION_PROPOSED',
      'TICKET_RESOLVED',
    ]);
    expect(timeline.body[0].metadata.correlationId).toBe(
      'ticket-creation-flow',
    );

    const closure = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/closure`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .send({
        actorId: 'support-1',
        reason: 'El usuario confirmó la solución',
      })
      .expect(201);
    expect(closure.body.status).toBe('CLOSED');
  });

  it('requires and records human approval for medium-risk remediation', async () => {
    const created = await asRole(
      request(app.getHttpServer()).post('/api/v1/tickets'),
      'END_USER',
      'user-approval',
    )
      .send({
        subject: 'VPN no conecta',
        description: 'El cliente falla',
        requesterId: 'user-approval',
      })
      .expect(201);
    await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/classifications`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .expect(201);
    await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/diagnostics`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .send({ operatingSystem: 'WINDOWS', errorMessage: 'No conecta' })
      .expect(201);

    const proposed = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/tickets/${created.body.id}/remediations`,
      ),
      'SUPPORT_AGENT',
      'support-1',
    )
      .send({
        action: 'RESET_VPN_CONFIGURATION',
        requestedBy: 'diagnostic-agent',
      })
      .expect(201);
    expect(proposed.body.ticketStatus).toBe('PENDING_APPROVAL');

    const pending = await asRole(
      request(app.getHttpServer()).get('/api/v1/remediations/pending'),
      'APPROVER',
      'approver-1',
    )
      .expect(200);
    expect(pending.body).toHaveLength(1);

    const approved = await asRole(
      request(app.getHttpServer()).post(
        `/api/v1/remediations/${proposed.body.id}/approval`,
      ),
      'APPROVER',
      'approver-1',
    )
      .send({
        approved: true,
        actorId: 'approver-1',
        reason: 'Cambio autorizado',
      })
      .expect(201);
    expect(approved.body).toMatchObject({
      status: 'EXECUTED',
      verificationStatus: 'PASSED',
      ticketStatus: 'IN_REMEDIATION',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
