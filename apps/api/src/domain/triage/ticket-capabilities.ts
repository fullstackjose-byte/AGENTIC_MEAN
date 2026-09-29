import type { TicketClassification } from './ticket-classification.js';

export type TicketAction =
  | 'RUN_VPN_DIAGNOSTIC'
  | 'REQUEST_INFORMATION'
  | 'ESCALATE_HUMAN';

export type GuidanceCode =
  | 'VPN_DIAGNOSTIC_AVAILABLE'
  | 'INFORMATION_REQUIRED'
  | 'IDENTITY_REQUIRES_HUMAN'
  | 'PROVISIONING_REQUIRES_HUMAN'
  | 'UNSUPPORTED_REQUIRES_HUMAN'
  | 'CRITICAL_REQUIRES_HUMAN';

export interface TicketCapabilities {
  classification: TicketClassification;
  allowedActions: TicketAction[];
  guidanceCode: GuidanceCode;
  slaExpectation: string;
}

export function buildTicketCapabilities(
  classification: TicketClassification,
): TicketCapabilities {
  const slaExpectation = slaFor(classification.priority);
  if (classification.priority === 'P1') {
    return {
      classification,
      allowedActions: ['ESCALATE_HUMAN'],
      guidanceCode: 'CRITICAL_REQUIRES_HUMAN',
      slaExpectation,
    };
  }
  if (classification.missingInformation.length > 0) {
    return {
      classification,
      allowedActions: ['REQUEST_INFORMATION', 'ESCALATE_HUMAN'],
      guidanceCode: 'INFORMATION_REQUIRED',
      slaExpectation,
    };
  }
  if (
    classification.category === 'INFRASTRUCTURE_SOFTWARE' &&
    classification.subcategory === 'VPN' &&
    classification.confidence >= 0.8 &&
    classification.nextAction === 'HANDOFF_DIAGNOSTIC'
  ) {
    return {
      classification,
      allowedActions: ['RUN_VPN_DIAGNOSTIC'],
      guidanceCode: 'VPN_DIAGNOSTIC_AVAILABLE',
      slaExpectation,
    };
  }
  const guidanceCode: GuidanceCode =
    classification.category === 'ACCESS_IDENTITY'
      ? 'IDENTITY_REQUIRES_HUMAN'
      : classification.category === 'PROVISIONING_PERMISSIONS'
        ? 'PROVISIONING_REQUIRES_HUMAN'
        : 'UNSUPPORTED_REQUIRES_HUMAN';
  return {
    classification,
    allowedActions: ['ESCALATE_HUMAN'],
    guidanceCode,
    slaExpectation,
  };
}

function slaFor(priority: TicketClassification['priority']): string {
  return (
    {
      P1: 'Atención humana inmediata; objetivo de respuesta: 15 minutos.',
      P2: 'Objetivo de primera respuesta: 1 hora.',
      P3: 'Objetivo de primera respuesta: 4 horas.',
      P4: 'Objetivo de primera respuesta: 8 horas hábiles.',
    } as const
  )[priority];
}
