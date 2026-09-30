import { sanitizeLogValue } from './log-sanitizer.js';

describe('sanitizeLogValue', () => {
  it('redacts sensitive keys and secrets embedded in text recursively', () => {
    expect(
      sanitizeLogValue({
        authorization: 'Bearer abcdefghijk',
        nested: {
          message: 'password=hunter2 email ana@example.com ip 10.0.0.4',
          apiKey: 'sk-secret',
        },
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      nested: {
        message:
          'password=[REDACTED] email [EMAIL_REDACTED] ip [PRIVATE_IP_REDACTED]',
        apiKey: '[REDACTED]',
      },
    });
  });
});
