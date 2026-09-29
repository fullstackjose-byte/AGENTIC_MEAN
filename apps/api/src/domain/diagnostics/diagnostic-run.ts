import type {
  OperatingSystem,
  VpnDiagnosticResult,
} from '../../application/ports/vpn-diagnostic.port.js';
import type { TicketStatus } from '../tickets/ticket-state-machine.js';

export type DiagnosticOutcome =
  | 'CONNECTIVITY_OK'
  | 'DNS_FAILURE'
  | 'ENDPOINT_UNREACHABLE'
  | 'INCONCLUSIVE';

export type DiagnosticRecommendation =
  | 'VERIFY_CLIENT_CONFIGURATION'
  | 'CHECK_DNS_CONFIGURATION'
  | 'VERIFY_NETWORK_OR_SERVICE'
  | 'ESCALATE_HUMAN';

export interface DiagnosticRun extends VpnDiagnosticResult {
  id: string;
  ticketId: string;
  operatingSystem: OperatingSystem;
  errorMessage: string;
  outcome: DiagnosticOutcome;
  recommendation: DiagnosticRecommendation;
  createdAt: Date;
}

export interface DiagnosticResult extends DiagnosticRun {
  ticketStatus: TicketStatus;
}
