import { describe, expect, it, vi } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import {
  InvalidLanguageModelOutputError,
  LanguageModelUnavailableError,
  OpenAiLanguageModelAdapter,
  type OpenAiResponsesClient,
} from './openai-language-model.adapter.js';

const validOutput = JSON.stringify({
  category: 'INFRASTRUCTURE_SOFTWARE',
  subcategory: 'VPN',
  impact: 'SINGLE_USER',
  urgency: 'MEDIUM',
  confidence: 0.92,
  entities: {
    affectedUser: null,
    impactedService: 'corporate-vpn',
    businessCriticality: 'MEDIUM',
  },
  missingInformation: [],
});

function ticket() {
  return Ticket.create({
    id: '11111111-1111-4111-8111-111111111111',
    number: 'TCK-2026-000001',
    subject: 'VPN de ana@example.com',
    description: 'Llamar al +57 310 555 1234; token=secret-value',
    requesterId: 'user-internal-123',
    createdAt: new Date('2026-09-29T15:00:00.000Z'),
    containsRedactedData: false,
  });
}

function adapter(create: OpenAiResponsesClient['responses']['create']) {
  return new OpenAiLanguageModelAdapter(
    { responses: { create } },
    { model: 'configured-model', timeoutMs: 50, maxTransientRetries: 1 },
  );
}

describe('OpenAiLanguageModelAdapter', () => {
  it('uses Responses structured output and sends only minimal sanitized context', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: validOutput });
    const result = await adapter(create).classifyTicket(ticket());
    expect(result).toMatchObject({
      category: 'INFRASTRUCTURE_SOFTWARE',
      subcategory: 'VPN',
      confidence: 0.92,
    });
    const request = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request).toMatchObject({ model: 'configured-model', store: false });
    expect(request.text).toMatchObject({
      format: { type: 'json_schema', strict: true },
    });
    const input = String(request.input);
    expect(input).toContain('[EMAIL_REDACTED]');
    expect(input).toContain('[PHONE_REDACTED]');
    expect(input).toContain('token=[REDACTED]');
    expect(input).not.toContain('ana@example.com');
    expect(input).not.toContain('user-internal-123');
  });

  it('rejects malformed or out-of-contract output', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({ category: 'INVENTED' }),
    });
    await expect(
      adapter(create).classifyTicket(ticket()),
    ).rejects.toBeInstanceOf(InvalidLanguageModelOutputError);
  });

  it('retries a transient failure once', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('rate limited'), { status: 429 }),
      )
      .mockResolvedValueOnce({ output_text: validOutput });
    await expect(
      adapter(create).classifyTicket(ticket()),
    ).resolves.toMatchObject({
      category: 'INFRASTRUCTURE_SOFTWARE',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('converts timeout into a safe provider error', async () => {
    const create = vi.fn(
      () => new Promise<{ output_text: string }>(() => undefined),
    );
    const subject = new OpenAiLanguageModelAdapter(
      { responses: { create } },
      { model: 'configured-model', timeoutMs: 5, maxTransientRetries: 0 },
    );
    await expect(subject.classifyTicket(ticket())).rejects.toBeInstanceOf(
      LanguageModelUnavailableError,
    );
  });
});
