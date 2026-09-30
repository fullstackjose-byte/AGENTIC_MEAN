export type TicketStatus =
  | 'NEW'
  | 'CLASSIFIED'
  | 'IN_DIAGNOSIS'
  | 'PENDING_USER'
  | 'PENDING_APPROVAL'
  | 'IN_REMEDIATION'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface Ticket {
  id: string;
  number: string;
  subject: string;
  description: string;
  requesterId: string;
  status: TicketStatus;
  priority: TicketPriority;
  containsRedactedData: boolean;
  createdAt: string;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  requesterId: string;
}

export interface TicketConnection {
  items: Ticket[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface TicketFilters {
  cursor?: string;
  limit?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  q?: string;
}

export interface TicketClassification {
  id: string;
  ticketId: string;
  category: string;
  subcategory: string;
  priority: TicketPriority;
  confidence: number;
  impact: string;
  urgency: string;
  entities: {
    affectedUser?: string;
    impactedService?: string;
    businessCriticality?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  missingInformation: string[];
  nextAction: 'HANDOFF_DIAGNOSTIC' | 'ESCALATE_HUMAN';
  reason:
    | 'SUPPORTED_AND_COMPLETE'
    | 'LOW_CONFIDENCE_OR_UNSUPPORTED'
    | 'NO_AUTOMATED_DIAGNOSTIC'
    | 'CRITICAL_PRIORITY';
  ticketStatus?: TicketStatus;
  createdAt: string;
}

export type TicketAction =
  | 'RUN_VPN_DIAGNOSTIC'
  | 'REQUEST_INFORMATION'
  | 'ESCALATE_HUMAN';

export interface TicketCapabilities {
  classification: TicketClassification;
  allowedActions: TicketAction[];
  guidanceCode:
    | 'VPN_DIAGNOSTIC_AVAILABLE'
    | 'INFORMATION_REQUIRED'
    | 'IDENTITY_REQUIRES_HUMAN'
    | 'PROVISIONING_REQUIRES_HUMAN'
    | 'UNSUPPORTED_REQUIRES_HUMAN'
    | 'CRITICAL_REQUIRES_HUMAN';
  slaExpectation: string;
}

export interface TicketClassificationResult extends TicketClassification {
  ticketStatus: TicketStatus;
  capabilities: TicketCapabilities;
}

export type OperatingSystem = 'WINDOWS' | 'MACOS' | 'LINUX';

export interface DiagnosticResult {
  id: string;
  ticketId: string;
  operatingSystem: OperatingSystem;
  dnsResolved: boolean;
  tcpReachable: boolean;
  latencyMs: number | null;
  errorCode: string | null;
  outcome:
    | 'CONNECTIVITY_OK'
    | 'DNS_FAILURE'
    | 'ENDPOINT_UNREACHABLE'
    | 'INCONCLUSIVE';
  recommendation: string;
  ticketStatus: TicketStatus;
  createdAt: string;
}

export type RemediationAction =
  | 'REFRESH_VPN_PROFILE'
  | 'RESET_VPN_CONFIGURATION'
  | 'DISABLE_SECURITY_CONTROLS';

export interface Remediation {
  id: string;
  ticketId: string;
  action: RemediationAction;
  risk: 'LOW' | 'MEDIUM';
  status: 'PENDING_APPROVAL' | 'EXECUTED' | 'REJECTED' | 'FAILED';
  verificationStatus: 'NOT_RUN' | 'PASSED' | 'FAILED';
  requestedBy: string;
  decidedBy: string | null;
  decisionReason: string | null;
  ticketStatus?: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  ticketId: string;
  type: string;
  actorId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}
