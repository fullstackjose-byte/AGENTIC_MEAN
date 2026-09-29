import { sanitizeLogValue } from './log-sanitizer.js';

describe('sanitizeLogValue', () => {
  it('redacts sensitive keys and secrets embedded in text recursively', () => {
    expect(
      sanitizeLogValue({
        authorization: 'Bearer abcdefghijk',
        nested: { message: 'password=hunter2', apiKey: 'sk-secret' },
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      nested: { message: 'password=[REDACTED]', apiKey: '[REDACTED]' },
    });
  });
});
