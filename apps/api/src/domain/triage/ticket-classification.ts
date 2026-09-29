import type {
  SupportCategory,
  TriageImpact,
  TriageUrgency,
  TriageEntities,
} from '../../application/ports/language-model.port.js';
import type { TicketPriority } from '../tickets/priority-policy.js';

export type TriageNextAction = 'HANDOFF_DIAGNOSTIC' | 'ESCALATE_HUMAN';
export type TriageReason =
  | 'SUPPORTED_AND_COMPLETE'
  | 'LOW_CONFIDENCE_OR_UNSUPPORTED'
  | 'NO_AUTOMATED_DIAGNOSTIC'
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
  entities: TriageEntities;
  missingInformation: string[];
  nextAction: TriageNextAction;
  reason: TriageReason;
  createdAt: Date;
}
