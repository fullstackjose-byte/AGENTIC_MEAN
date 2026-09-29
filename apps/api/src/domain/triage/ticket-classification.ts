import type {
  SupportCategory,
  TriageImpact,
  TriageUrgency,
} from '../../application/ports/language-model.port.js';
import type { TicketPriority } from '../tickets/priority-policy.js';

export type TriageNextAction = 'HANDOFF_DIAGNOSTIC' | 'ESCALATE_HUMAN';
export type TriageReason =
  | 'SUPPORTED_AND_COMPLETE'
  | 'LOW_CONFIDENCE_OR_UNSUPPORTED'
  | 'CRITICAL_PRIORITY';

export interface TicketClassification {
  id: string;
  ticketId: string;
  category: SupportCategory;
  subcategory: string;
  impact: TriageImpact;
  urgency: TriageUrgency;
  priority: TicketPriority;
  confidence: number;
  entities: Record<string, string>;
  missingInformation: string[];
  nextAction: TriageNextAction;
  reason: TriageReason;
  createdAt: Date;
}
