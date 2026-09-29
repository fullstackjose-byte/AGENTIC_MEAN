import type { Ticket } from '../../domain/tickets/ticket.js';

export const LANGUAGE_MODEL_PORT = Symbol('LANGUAGE_MODEL_PORT');

export type SupportCategory =
  | 'ACCESS_IDENTITY'
  | 'INFRASTRUCTURE_SOFTWARE'
  | 'PROVISIONING_PERMISSIONS'
  | 'OTHER';

export type TriageImpact = 'SINGLE_USER' | 'MULTIPLE_USERS' | 'WIDESPREAD';
export type TriageUrgency = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TriageEntities {
  affectedUser?: string;
  impactedService?: string;
  businessCriticality?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TriageModelOutput {
  category: SupportCategory;
  subcategory: string;
  impact: TriageImpact;
  urgency: TriageUrgency;
  confidence: number;
  entities: TriageEntities;
  missingInformation: string[];
}

export interface LanguageModelPort {
  classifyTicket(ticket: Ticket): Promise<TriageModelOutput>;
}
