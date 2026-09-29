import type { TicketClassification } from './ticket-classification.js';
import { buildTicketCapabilities } from './ticket-capabilities.js';

function classification(
  overrides: Partial<TicketClassification> = {},
): TicketClassification {
  return {
    id: 'classification-1',
    ticketId: 'ticket-1',
    category: 'INFRASTRUCTURE_SOFTWARE',
    subcategory: 'VPN',
    impact: 'SINGLE_USER',
    urgency: 'MEDIUM',
    priority: 'P3',
    confidence: 0.94,
    entities: {
      affectedUser: 'user-1',
      impactedService: 'corporate-vpn',
      businessCriticality: 'MEDIUM',
    },
    missingInformation: [],
    nextAction: 'HANDOFF_DIAGNOSTIC',
    reason: 'SUPPORTED_AND_COMPLETE',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('buildTicketCapabilities', () => {
  it('allows VPN only when the latest classification is complete and confident', () => {
    expect(buildTicketCapabilities(classification()).allowedActions).toEqual([
      'RUN_VPN_DIAGNOSTIC',
    ]);
  });

  it.each([
    ['ACCESS_IDENTITY', 'IDENTITY_REQUIRES_HUMAN'],
    ['PROVISIONING_PERMISSIONS', 'PROVISIONING_REQUIRES_HUMAN'],
    ['OTHER', 'UNSUPPORTED_REQUIRES_HUMAN'],
  ] as const)('does not offer VPN for %s', (category, guidanceCode) => {
    const result = buildTicketCapabilities(
      classification({
        category,
        subcategory: 'NOT_VPN',
        nextAction: 'ESCALATE_HUMAN',
        reason: 'NO_AUTOMATED_DIAGNOSTIC',
      }),
    );
    expect(result.allowedActions).not.toContain('RUN_VPN_DIAGNOSTIC');
    expect(result.guidanceCode).toBe(guidanceCode);
  });

  it('requests missing information instead of offering an incompatible action', () => {
    const result = buildTicketCapabilities(
      classification({
        missingInformation: ['businessCriticality'],
        nextAction: 'ESCALATE_HUMAN',
        reason: 'LOW_CONFIDENCE_OR_UNSUPPORTED',
      }),
    );
    expect(result.allowedActions).toEqual([
      'REQUEST_INFORMATION',
      'ESCALATE_HUMAN',
    ]);
  });

  it('escalates P1 without offering automation', () => {
    const result = buildTicketCapabilities(
      classification({ priority: 'P1', reason: 'CRITICAL_PRIORITY' }),
    );
    expect(result.allowedActions).toEqual(['ESCALATE_HUMAN']);
    expect(result.guidanceCode).toBe('CRITICAL_REQUIRES_HUMAN');
  });
});
