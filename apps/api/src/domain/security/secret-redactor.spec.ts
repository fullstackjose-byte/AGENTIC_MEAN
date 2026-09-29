import { describe, expect, it } from 'vitest';
import { redactSecrets } from './secret-redactor.js';

describe('secret redactor', () => {
  it.each([
    ['password=SuperSecret123', 'password=[REDACTED]'],
    ['token: abcdefghijklmnop', 'token: [REDACTED]'],
    ['Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature', 'Bearer [REDACTED]'],
    ['sk-proj-example0123456789', '[REDACTED]'],
  ])('redacts a secret from %s', (input, expected) => {
    expect(redactSecrets(input).text).toContain(expected);
    expect(redactSecrets(input).redactionCount).toBeGreaterThan(0);
  });

  it('leaves ordinary help desk text unchanged', () => {
    const input = 'No puedo conectarme a la VPN desde esta mañana';
    expect(redactSecrets(input)).toEqual({ text: input, redactionCount: 0 });
  });

  it('is idempotent', () => {
    const once = redactSecrets('password=[REDACTED]');
    expect(redactSecrets(once.text)).toEqual(once);
  });
});
