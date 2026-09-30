import OpenAI from 'openai';
import type { LanguageModelPort } from '../../application/ports/language-model.port.js';
import { MockLanguageModelAdapter } from './mock-language-model.adapter.js';
import {
  OpenAiLanguageModelAdapter,
  type OpenAiResponsesClient,
} from './openai-language-model.adapter.js';

export function languageModelFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): LanguageModelPort {
  const provider = (environment.LLM_PROVIDER ?? 'mock').trim().toLowerCase();
  if (provider === 'mock') return new MockLanguageModelAdapter();
  if (provider !== 'openai') {
    throw new Error('LLM_PROVIDER must be mock or openai');
  }

  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim();
  if (!apiKey)
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
  if (!model)
    throw new Error('OPENAI_MODEL is required when LLM_PROVIDER=openai');

  const timeoutMs = parseTimeout(environment.OPENAI_TIMEOUT_MS);
  const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  return new OpenAiLanguageModelAdapter(
    client as unknown as OpenAiResponsesClient,
    { model, timeoutMs, maxTransientRetries: 1 },
  );
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 10_000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 120_000) {
    throw new Error('OPENAI_TIMEOUT_MS must be an integer from 100 to 120000');
  }
  return parsed;
}
