import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type {
  Ticket,
  TicketCapabilities,
} from '../domain/ticket.model';
import { TicketsApiService } from '../infrastructure/tickets-api.service';
import { TicketsPage } from './tickets-page';

const ticket: Ticket = {
  id: 'ticket-1',
  number: 'TCK-2026-000001',
  subject: 'Solicitud de soporte',
  description: 'Necesito ayuda',
  requesterId: 'usuario-demo',
  status: 'CLASSIFIED',
  priority: 'P3',
  containsRedactedData: false,
  createdAt: '2026-09-29T12:00:00.000Z',
};

function capabilities(
  category: string,
  subcategory: string,
  allowedActions: TicketCapabilities['allowedActions'],
  guidanceCode: TicketCapabilities['guidanceCode'],
): TicketCapabilities {
  return {
    classification: {
      id: 'classification-1',
      ticketId: ticket.id,
      category,
      subcategory,
      priority: 'P3',
      confidence: 0.96,
      impact: 'SINGLE_USER',
      urgency: 'NORMAL',
      entities: {
        affectedUser: 'usuario-demo',
        impactedService: subcategory,
        businessCriticality: 'MEDIUM',
      },
      missingInformation: [],
      nextAction: allowedActions.includes('RUN_VPN_DIAGNOSTIC')
        ? 'HANDOFF_DIAGNOSTIC'
        : 'ESCALATE_HUMAN',
      reason: allowedActions.includes('RUN_VPN_DIAGNOSTIC')
        ? 'SUPPORTED_AND_COMPLETE'
        : 'NO_AUTOMATED_DIAGNOSTIC',
      createdAt: '2026-09-29T12:00:00.000Z',
    },
    allowedActions,
    guidanceCode,
    slaExpectation: 'Atención dentro del SLA informado.',
  };
}

describe('TicketsPage', () => {
  async function render(ticketCapabilities: TicketCapabilities) {
    const api = {
      list: () =>
        of({ items: [ticket], pageInfo: { nextCursor: null, hasNextPage: false } }),
      pendingRemediations: () => of([]),
      capabilities: () => of(ticketCapabilities),
    };
    await TestBed.configureTestingModule({
      imports: [TicketsPage],
      providers: [{ provide: TicketsApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(TicketsPage);
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the VPN action only when the backend capability allows it', async () => {
    const content = await render(
      capabilities(
        'INFRASTRUCTURE_SOFTWARE',
        'VPN',
        ['RUN_VPN_DIAGNOSTIC'],
        'VPN_DIAGNOSTIC_AVAILABLE',
      ),
    );
    expect(content).toContain('Diagnosticar VPN');
  });

  it('does not offer VPN diagnostics for identity incidents', async () => {
    const content = await render(
      capabilities(
        'IDENTITY_ACCESS',
        'ACCOUNT_LOCKOUT',
        ['ESCALATE_HUMAN'],
        'IDENTITY_REQUIRES_HUMAN',
      ),
    );
    expect(content).not.toContain('Diagnosticar VPN');
    expect(content).toContain('especialista de identidad');
  });

  it('keeps the ticket list visible while showing a success message', async () => {
    const api = {
      list: () =>
        of({ items: [ticket], pageInfo: { nextCursor: null, hasNextPage: false } }),
      pendingRemediations: () => of([]),
      capabilities: () =>
        of(
          capabilities(
            'INFRASTRUCTURE_SOFTWARE',
            'VPN',
            ['RUN_VPN_DIAGNOSTIC'],
            'VPN_DIAGNOSTIC_AVAILABLE',
          ),
        ),
      create: () =>
        of({ ...ticket, id: 'ticket-success', number: 'TCK-2026-SUCCESS' }),
    };
    await TestBed.configureTestingModule({
      imports: [TicketsPage],
      providers: [{ provide: TicketsApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(TicketsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: { setValue(value: { subject: string; description: string; requesterId: string }): void };
      submit(): void;
    };
    component.form.setValue({
      subject: 'VPN no conecta',
      description: 'El cliente falla al iniciar',
      requesterId: 'usuario-demo',
    });
    component.submit();
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('fue creado correctamente');
    expect(content).toContain('TCK-2026-SUCCESS');
    expect(content).toContain('TCK-2026-000001');
  });
});
