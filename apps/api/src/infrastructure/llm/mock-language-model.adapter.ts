import type {
  LanguageModelPort,
  SupportCategory,
  TriageImpact,
  TriageModelOutput,
  TriageUrgency,
} from '../../application/ports/language-model.port.js';
import type { Ticket } from '../../domain/tickets/ticket.js';

interface CategoryMatch {
  category: SupportCategory;
  subcategory: string;
  impactedService: string;
}

export class MockLanguageModelAdapter implements LanguageModelPort {
  classifyTicket(ticket: Ticket): Promise<TriageModelOutput> {
    const text = normalize(`${ticket.subject} ${ticket.description}`);
    const match = this.detectCategory(text);

    return Promise.resolve({
      category: match?.category ?? 'OTHER',
      subcategory: match?.subcategory ?? 'UNDETERMINED',
      impact: this.detectImpact(text),
      urgency: this.detectUrgency(text),
      confidence: match ? 0.94 : 0.45,
      entities: match
        ? {
            affectedUser: ticket.requesterId,
            impactedService: match.impactedService,
            businessCriticality: this.detectUrgency(text),
          }
        : { affectedUser: ticket.requesterId },
      missingInformation: match
        ? []
        : ['impactedService', 'businessCriticality'],
    });
  }

  private detectCategory(text: string): CategoryMatch | undefined {
    if (includesAny(text, ['vpn'])) {
      return {
        category: 'INFRASTRUCTURE_SOFTWARE',
        subcategory: 'VPN',
        impactedService: 'corporate-vpn',
      };
    }
    if (includesAny(text, ['contrasena', 'password', 'cuenta', 'mfa'])) {
      return {
        category: 'ACCESS_IDENTITY',
        subcategory: 'IDENTITY_ACCESS',
        impactedService: 'identity-provider',
      };
    }
    if (includesAny(text, ['licencia', 'permiso', 'carpeta', 'repositorio'])) {
      return {
        category: 'PROVISIONING_PERMISSIONS',
        subcategory: 'ACCESS_REQUEST',
        impactedService: 'access-management',
      };
    }
    return undefined;
  }

  private detectImpact(text: string): TriageImpact {
    if (
      includesAny(text, [
        'toda la empresa',
        'todos los usuarios',
        'nadie puede',
        'caida global',
      ])
    ) {
      return 'WIDESPREAD';
    }
    if (includesAny(text, ['varios usuarios', 'todo el equipo'])) {
      return 'MULTIPLE_USERS';
    }
    return 'SINGLE_USER';
  }

  private detectUrgency(text: string): TriageUrgency {
    if (includesAny(text, ['urgente', 'critico', 'caido', 'caida'])) {
      return 'HIGH';
    }
    if (includesAny(text, ['solicitud', 'cuando sea posible'])) return 'LOW';
    return 'MEDIUM';
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}
