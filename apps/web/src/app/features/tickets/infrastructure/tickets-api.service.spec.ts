import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TicketsApiService } from './tickets-api.service';

describe('TicketsApiService', () => {
  let api: TicketsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TicketsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads tickets from the API', () => {
    const expected = [
      {
        id: 'ticket-1',
        number: 'TCK-2026-000001',
        subject: 'VPN no conecta',
        description: 'Error de conexión',
        requesterId: 'user-1',
        status: 'NEW' as const,
        priority: 'P4' as const,
        containsRedactedData: false,
        createdAt: '2026-09-29T15:00:00.000Z',
      },
    ];

    api.list().subscribe((connection) => expect(connection.items).toEqual(expected));
    http.expectOne('http://localhost:3000/api/v1/tickets').flush({
      items: expected,
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
  });

  it('sends pagination and filters as query parameters', () => {
    api.list({ limit: 10, cursor: 'next', status: 'NEW', priority: 'P4', q: 'vpn' }).subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === 'http://localhost:3000/api/v1/tickets',
    );
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.params.get('cursor')).toBe('next');
    expect(request.request.params.get('status')).toBe('NEW');
    expect(request.request.params.get('priority')).toBe('P4');
    expect(request.request.params.get('q')).toBe('vpn');
    request.flush({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
  });

  it('creates a ticket through the API', () => {
    const input = {
      subject: 'Cuenta bloqueada',
      description: 'No puedo ingresar',
      requesterId: 'user-2',
    };

    api.create(input).subscribe();
    const request = http.expectOne('http://localhost:3000/api/v1/tickets');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    expect(request.request.headers.get('X-User-Id')).toBe('user-2');
    expect(request.request.headers.get('X-User-Role')).toBe('END_USER');
    request.flush({ ...input, id: 'ticket-2' });
  });

  it('asks the triage agent to classify a ticket', () => {
    api.triage('ticket-1').subscribe();

    const request = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/classifications',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.headers.get('X-User-Role')).toBe('SUPPORT_AGENT');
    request.flush({
      id: 'classification-1',
      ticketId: 'ticket-1',
      category: 'INFRASTRUCTURE_SOFTWARE',
      subcategory: 'VPN',
      priority: 'P3',
      confidence: 0.94,
      nextAction: 'HANDOFF_DIAGNOSTIC',
      reason: 'SUPPORTED_AND_COMPLETE',
      ticketStatus: 'CLASSIFIED',
      createdAt: '2026-09-29T15:00:00.000Z',
    });
  });

  it('starts a VPN diagnostic for a classified ticket', () => {
    api
      .diagnose('ticket-1', {
        operatingSystem: 'WINDOWS',
        errorMessage: 'El cliente muestra timeout',
      })
      .subscribe();

    const request = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/diagnostics',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      operatingSystem: 'WINDOWS',
      errorMessage: 'El cliente muestra timeout',
    });
    request.flush({
      id: 'diagnostic-1',
      ticketId: 'ticket-1',
      operatingSystem: 'WINDOWS',
      dnsResolved: true,
      tcpReachable: true,
      latencyMs: 42,
      errorCode: null,
      outcome: 'CONNECTIVITY_OK',
      recommendation: 'VERIFY_CLIENT_CONFIGURATION',
      ticketStatus: 'IN_DIAGNOSIS',
      createdAt: '2026-09-29T17:00:00.000Z',
    });
  });

  it('loads backend-authoritative capabilities for a ticket', () => {
    api.capabilities('ticket-1').subscribe();
    const request = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/capabilities',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('X-User-Role')).toBe('SUPPORT_AGENT');
    request.flush({
      classification: { id: 'classification-1', ticketId: 'ticket-1' },
      allowedActions: ['RUN_VPN_DIAGNOSTIC'],
      guidanceCode: 'VPN_DIAGNOSTIC_AVAILABLE',
      slaExpectation: 'Diagnóstico inmediato.',
    });
  });

  it('proposes a remediation', () => {
    api
      .remediate('ticket-1', {
        action: 'REFRESH_VPN_PROFILE',
        requestedBy: 'diagnostic-agent',
      })
      .subscribe();
    const request = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/remediations',
    );
    expect(request.request.method).toBe('POST');
    request.flush({ id: 'remediation-1' });
  });

  it('lists and approves pending remediations', () => {
    api.pendingRemediations().subscribe();
    http
      .expectOne('http://localhost:3000/api/v1/remediations/pending')
      .flush([]);

    api
      .decideRemediation('remediation-1', {
        approved: true,
        actorId: 'approver-1',
        reason: 'Autorizado',
      })
      .subscribe();
    const approval = http.expectOne(
      'http://localhost:3000/api/v1/remediations/remediation-1/approval',
    );
    expect(approval.request.method).toBe('POST');
    expect(approval.request.headers.get('X-User-Role')).toBe('APPROVER');
    approval.flush({ id: 'remediation-1', status: 'EXECUTED' });
  });

  it('resolves a verified ticket', () => {
    api.resolve('ticket-1', 'Conectividad verificada').subscribe();
    const request = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/resolution',
    );
    expect(request.request.body).toEqual({
      resolutionSummary: 'Conectividad verificada',
    });
    request.flush({ ticketId: 'ticket-1', status: 'RESOLVED' });
  });

  it('loads the audit timeline', () => {
    api.timeline('ticket-1').subscribe();
    const request = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/timeline',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('closes and reopens tickets with an actor and reason', () => {
    const input = { actorId: 'support-1', reason: 'Estado confirmado' };
    api.close('ticket-1', input).subscribe();
    const closure = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-1/closure',
    );
    expect(closure.request.body).toEqual(input);
    closure.flush({ ticketId: 'ticket-1', status: 'CLOSED' });

    api.reopen('ticket-2', input).subscribe();
    const reopen = http.expectOne(
      'http://localhost:3000/api/v1/tickets/ticket-2/reopen',
    );
    expect(reopen.request.body).toEqual(input);
    reopen.flush({ ticketId: 'ticket-2', status: 'REOPENED' });
  });
});
