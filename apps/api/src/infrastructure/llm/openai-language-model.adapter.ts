import type {
  LanguageModelPort,
  SupportCategory,
  TriageImpact,
  TriageModelOutput,
  TriageUrgency,
} from '../../application/ports/language-model.port.js';
import { redactSensitiveData } from '../../domain/security/secret-redactor.js';
import type { Ticket } from '../../domain/tickets/ticket.js';

export const ALLOWED_SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  'ACCESS_IDENTITY',
  'INFRASTRUCTURE_SOFTWARE',
  'PROVISIONING_PERMISSIONS',
  'OTHER',
];

const IMPACTS: readonly TriageImpact[] = [
  'SINGLE_USER',
  'MULTIPLE_USERS',
  'WIDESPREAD',
];
const URGENCIES: readonly TriageUrgency[] = ['LOW', 'MEDIUM', 'HIGH'];

export interface OpenAiResponsesClient {
  responses: {
    create(input: Record<string, unknown>): Promise<{ output_text?: string }>;
  };
}

export interface OpenAiAdapterConfig {
  model: string;
  timeoutMs: number;
  locale?: string;
  maxTransientRetries?: number;
}

export class InvalidLanguageModelOutputError extends Error {
  constructor() {
    super('Language model returned an invalid structured classification');
    this.name = 'InvalidLanguageModelOutputError';
  }
}

export class LanguageModelUnavailableError extends Error {
  constructor() {
    super('Language model is temporarily unavailable');
    this.name = 'LanguageModelUnavailableError';
  }
}

export class OpenAiLanguageModelAdapter implements LanguageModelPort {
  constructor(
    private readonly client: OpenAiResponsesClient,
    private readonly config: OpenAiAdapterConfig,
  ) {}

  async classifyTicket(ticket: Ticket): Promise<TriageModelOutput> {
    const request = this.buildRequest(ticket);
    const retries = Math.max(
      0,
      Math.min(this.config.maxTransientRetries ?? 1, 1),
    );
    let attempt = 0;

    while (true) {
      try {
        const response = await this.withTimeout(
          this.client.responses.create(request),
        );
        return validateStructuredOutput(response.output_text);
      } catch (error) {
        if (error instanceof InvalidLanguageModelOutputError) throw error;
        if (attempt >= retries || !isTransient(error)) {
          throw new LanguageModelUnavailableError();
        }
        attempt += 1;
      }
    }
  }

  private buildRequest(ticket: Ticket): Record<string, unknown> {
    const payload = {
      ticketId: ticket.id,
      subject: redactSensitiveData(ticket.subject).text,
      description: redactSensitiveData(ticket.description).text,
      locale: this.config.locale ?? 'es-CO',
      allowedCategories: ALLOWED_SUPPORT_CATEGORIES,
    };
    return {
      model: this.config.model,
      store: false,
      instructions:
        'Clasifica el ticket usando solo el catalogo permitido. No infieras identidad ni cambies prioridad, SLA, capacidades o estado.',
      input: JSON.stringify(payload),
      text: {
        format: {
          type: 'json_schema',
          name: 'helpdesk_ticket_classification',
          strict: true,
          schema: TRIAGE_SCHEMA,
        },
      },
    };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(Object.assign(new Error('timeout'), { transient: true })),
            this.config.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'category',
    'subcategory',
    'impact',
    'urgency',
    'confidence',
    'entities',
    'missingInformation',
  ],
  properties: {
    category: { type: 'string', enum: ALLOWED_SUPPORT_CATEGORIES },
    subcategory: { type: 'string', minLength: 1, maxLength: 80 },
    impact: { type: 'string', enum: IMPACTS },
    urgency: { type: 'string', enum: URGENCIES },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    entities: {
      type: 'object',
      additionalProperties: false,
      required: ['affectedUser', 'impactedService', 'businessCriticality'],
      properties: {
        affectedUser: { type: ['string', 'null'] },
        impactedService: { type: ['string', 'null'] },
        businessCriticality: {
          type: ['string', 'null'],
          enum: ['LOW', 'MEDIUM', 'HIGH', null],
        },
      },
    },
    missingInformation: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', maxLength: 80 },
    },
  },
} as const;

export function validateStructuredOutput(
  raw: string | undefined,
): TriageModelOutput {
  if (!raw) throw new InvalidLanguageModelOutputError();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new InvalidLanguageModelOutputError();
  }
  if (!value || typeof value !== 'object')
    throw new InvalidLanguageModelOutputError();
  const output = value as Record<string, unknown>;
  const entities = output.entities as Record<string, unknown> | undefined;
  if (
    !hasOnlyKeys(output, [
      'category',
      'subcategory',
      'impact',
      'urgency',
      'confidence',
      'entities',
      'missingInformation',
    ]) ||
    !ALLOWED_SUPPORT_CATEGORIES.includes(output.category as SupportCategory) ||
    typeof output.subcategory !== 'string' ||
    !output.subcategory.trim() ||
    !IMPACTS.includes(output.impact as TriageImpact) ||
    !URGENCIES.includes(output.urgency as TriageUrgency) ||
    typeof output.confidence !== 'number' ||
    !Number.isFinite(output.confidence) ||
    output.confidence < 0 ||
    output.confidence > 1 ||
    !entities ||
    !hasOnlyKeys(entities, [
      'affectedUser',
      'impactedService',
      'businessCriticality',
    ]) ||
    (entities.affectedUser != null &&
      typeof entities.affectedUser !== 'string') ||
    !Array.isArray(output.missingInformation) ||
    output.missingInformation.length > 10 ||
    !output.missingInformation.every((item) => typeof item === 'string')
  ) {
    throw new InvalidLanguageModelOutputError();
  }
  const impactedService = optionalString(entities.impactedService);
  const criticality = entities.businessCriticality;
  if (
    criticality != null &&
    !URGENCIES.includes(criticality as TriageUrgency)
  ) {
    throw new InvalidLanguageModelOutputError();
  }
  return {
    category: output.category as SupportCategory,
    subcategory: redactSensitiveData(output.subcategory).text,
    impact: output.impact as TriageImpact,
    urgency: output.urgency as TriageUrgency,
    confidence: output.confidence,
    entities: {
      ...(impactedService
        ? { impactedService: redactSensitiveData(impactedService).text }
        : {}),
      ...(criticality
        ? { businessCriticality: criticality as 'LOW' | 'MEDIUM' | 'HIGH' }
        : {}),
    },
    missingInformation: output.missingInformation.map(
      (item) => redactSensitiveData(item as string).text,
    ),
  };
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') throw new InvalidLanguageModelOutputError();
  return value;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isTransient(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const candidate = error as {
      status?: number;
      transient?: boolean;
      name?: string;
    };
    return (
      candidate.transient === true ||
      candidate.name === 'APIConnectionError' ||
      candidate.name === 'APIConnectionTimeoutError' ||
      candidate.status === 408 ||
      candidate.status === 409 ||
      candidate.status === 429 ||
      (typeof candidate.status === 'number' && candidate.status >= 500)
    );
  }
  return false;
}
