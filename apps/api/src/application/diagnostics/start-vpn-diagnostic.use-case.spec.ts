import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import type { TicketClassification } from '../../domain/triage/ticket-classification.js';
import { InMemoryClassificationRepository } from '../../infrastructure/persistence/in-memory-classification.repository.js';
import { InMemoryDiagnosticRunRepository } from '../../infrastructure/persistence/in-memory-diagnostic-run.repository.js';
import { InMemoryTicketRepository } from '../../infrastructure/persistence/in-memory-ticket.repository.js';
import type {
  VpnDiagnosticPort,
  VpnDiagnosticResult,
} from '../ports/vpn-diagnostic.port.js';
import { StartVpnDiagnosticUseCase } from './start-vpn-diagnostic.use-case.js';

class FakeVpnDiagnostic implements VpnDiagnosticPort {
  constructor(private readonly result: VpnDiagnosticResult) {}

  check(): Promise<VpnDiagnosticResult> {
    return Promise.resolve(this.result);
  }
}

const classifiedTicket = () =>
  Ticket.restore({
    id: '11111111-1111-4111-8111-111111111111',
    number: 'TCK-2026-000001',
    subject: 'VPN no conecta',
    description: 'Error al establecer el tunel',
    requesterId: 'user-123',
    createdAt: new Date('2026-09-29T15:00:00.000Z'),
    containsRedactedData: false,
    status: 'CLASSIFIED',
    priority: 'P3',
  });

const vpnClassification = (): TicketClassification => ({
  id: 'classification-1',
  ticketId: classifiedTicket().id,
  category: 'INFRASTRUCTURE_SOFTWARE',
  subcategory: 'VPN',
  impact: 'SINGLE_USER',
  urgency: 'MEDIUM',
  priority: 'P3',
  confidence: 0.94,
  entities: { service: 'corporate-vpn' },
  missingInformation: [],
  nextAction: 'HANDOFF_DIAGNOSTIC',
  reason: 'SUPPORTED_AND_COMPLETE',
  createdAt: new Date('2026-09-29T16:00:00.000Z'),
});

const dependencies = {
  nextId: () => 'diagnostic-1',
  now: () => new Date('2026-09-29T17:00:00.000Z'),
};

async function repositories() {
  const tickets = new InMemoryTicketRepository([classifiedTicket()]);
  const classifications = new InMemoryClassificationRepository();
  await classifications.save(vpnClassification());
  return {
    tickets,
    classifications,
    runs: new InMemoryDiagnosticRunRepository(),
  };
}

describe('StartVpnDiagnosticUseCase', () => {
  it('runs and persists a safe VPN diagnostic', async () => {
    const { tickets, classifications, runs } = await repositories();
    const useCase = new StartVpnDiagnosticUseCase(
      tickets,
      classifications,
      runs,
      new FakeVpnDiagnostic({
        dnsResolved: true,
        tcpReachable: true,
        latencyMs: 42,
        errorCode: null,
      }),
      dependencies,
    );

    const result = await useCase.execute(classifiedTicket().id, {
      operatingSystem: 'WINDOWS',
      errorMessage: 'El cliente muestra timeout',
    });

    expect(result).toMatchObject({
      outcome: 'CONNECTIVITY_OK',
      recommendation: 'VERIFY_CLIENT_CONFIGURATION',
      ticketStatus: 'IN_DIAGNOSIS',
    });
    await expect(runs.findByTicketId(classifiedTicket().id)).resolves.toHaveLength(1);
  });

  it('escalates when the diagnostic tool is unavailable', async () => {
    const { tickets, classifications, runs } = await repositories();
    const useCase = new StartVpnDiagnosticUseCase(
      tickets,
      classifications,
      runs,
      new FakeVpnDiagnostic({
        dnsResolved: false,
        tcpReachable: false,
        latencyMs: null,
        errorCode: 'TOOL_UNAVAILABLE',
      }),
      dependencies,
    );

    await expect(
      useCase.execute(classifiedTicket().id, {
        operatingSystem: 'WINDOWS',
        errorMessage: 'No responde',
      }),
    ).resolves.toMatchObject({
      outcome: 'INCONCLUSIVE',
      recommendation: 'ESCALATE_HUMAN',
      ticketStatus: 'ESCALATED',
    });
  });

  it('rejects a diagnostic without required context', async () => {
    const { tickets, classifications, runs } = await repositories();
    const useCase = new StartVpnDiagnosticUseCase(
      tickets,
      classifications,
      runs,
      new FakeVpnDiagnostic({
        dnsResolved: true,
        tcpReachable: true,
        latencyMs: 10,
        errorCode: null,
      }),
      dependencies,
    );

    await expect(
      useCase.execute(classifiedTicket().id, {
        operatingSystem: 'WINDOWS',
        errorMessage: '  ',
      }),
    ).rejects.toThrow('Diagnostic error message is required');
  });

  it('rejects an unsupported operating system', async () => {
    const { tickets, classifications, runs } = await repositories();
    const useCase = new StartVpnDiagnosticUseCase(
      tickets,
      classifications,
      runs,
      new FakeVpnDiagnostic({
        dnsResolved: true,
        tcpReachable: true,
        latencyMs: 10,
        errorCode: null,
      }),
      dependencies,
    );

    await expect(
      useCase.execute(classifiedTicket().id, {
        operatingSystem: 'ANDROID' as 'WINDOWS',
        errorMessage: 'No conecta',
      }),
    ).rejects.toThrow('Unsupported operating system');
  });

  it('allows a reopened VPN ticket to return to diagnosis', async () => {
    const reopened = Ticket.restore({
      id: classifiedTicket().id,
      number: classifiedTicket().number,
      subject: classifiedTicket().subject,
      description: classifiedTicket().description,
      requesterId: classifiedTicket().requesterId,
      createdAt: classifiedTicket().createdAt,
      containsRedactedData: false,
      status: 'REOPENED',
      priority: 'P3',
    });
    const tickets = new InMemoryTicketRepository([reopened]);
    const classifications = new InMemoryClassificationRepository();
    await classifications.save(vpnClassification());
    const useCase = new StartVpnDiagnosticUseCase(
      tickets,
      classifications,
      new InMemoryDiagnosticRunRepository(),
      new FakeVpnDiagnostic({
        dnsResolved: true,
        tcpReachable: true,
        latencyMs: 12,
        errorCode: null,
      }),
      dependencies,
    );

    await expect(
      useCase.execute(reopened.id, {
        operatingSystem: 'WINDOWS',
        errorMessage: 'El problema regresó',
      }),
    ).resolves.toMatchObject({ ticketStatus: 'IN_DIAGNOSIS' });
  });
});
