import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { Ticket } from '../src/domain/tickets/ticket.js';
import {
  OpenAiLanguageModelAdapter,
  type OpenAiResponsesClient,
} from '../src/infrastructure/llm/openai-language-model.adapter.js';

const enabled =
  process.env.RUN_OPENAI_SMOKE_TEST === 'true' &&
  Boolean(process.env.OPENAI_API_KEY) &&
  Boolean(process.env.OPENAI_MODEL);

describe.skipIf(!enabled)('OpenAI billable smoke test', () => {
  it('performs one synthetic classification request without persistence', async () => {
    console.warn(
      'Running one real OpenAI request; this may generate billable usage.',
    );
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 10_000),
      maxRetries: 0,
    });
    const adapter = new OpenAiLanguageModelAdapter(
      client as unknown as OpenAiResponsesClient,
      {
        model: process.env.OPENAI_MODEL!,
        timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 10_000),
        maxTransientRetries: 0,
      },
    );
    const result = await adapter.classifyTicket(
      Ticket.create({
        id: '00000000-0000-4000-8000-000000000001',
        number: 'TCK-SYNTHETIC-001',
        subject: 'Synthetic VPN connectivity issue',
        description: 'Synthetic client cannot establish a VPN tunnel.',
        requesterId: 'synthetic-user',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        containsRedactedData: false,
      }),
    );
    expect(result.category).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
