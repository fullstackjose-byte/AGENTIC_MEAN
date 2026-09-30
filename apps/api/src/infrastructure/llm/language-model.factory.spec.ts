import { describe, expect, it } from 'vitest';
import { MockLanguageModelAdapter } from './mock-language-model.adapter.js';
import { languageModelFromEnvironment } from './language-model.factory.js';

describe('languageModelFromEnvironment', () => {
  it('uses the offline mock by default', () => {
    expect(languageModelFromEnvironment({})).toBeInstanceOf(
      MockLanguageModelAdapter,
    );
  });

  it.each([
    [
      { LLM_PROVIDER: 'openai', OPENAI_MODEL: 'configured-model' },
      'OPENAI_API_KEY',
    ],
    [{ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'not-logged' }, 'OPENAI_MODEL'],
  ])(
    'fails startup safely for incomplete OpenAI config',
    (environment, field) => {
      expect(() => languageModelFromEnvironment(environment)).toThrow(field);
    },
  );

  it('rejects unknown providers', () => {
    expect(() =>
      languageModelFromEnvironment({ LLM_PROVIDER: 'unknown' }),
    ).toThrow('mock or openai');
  });
});
