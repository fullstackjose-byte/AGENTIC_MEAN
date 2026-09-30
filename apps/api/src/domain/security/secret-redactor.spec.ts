import { describe, expect, it } from 'vitest';
import {
  assertOpaqueRequesterId,
  redactSecrets,
  redactSensitiveData,
} from './secret-redactor.js';

describe('secret redactor', () => {
  it.each([
    ['password=SuperSecret123', 'password=[REDACTED]'],
    ['token: abcdefghijklmnop', 'token: [REDACTED]'],
    ['Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature', 'Bearer [REDACTED]'],
    ['sk-proj-example0123456789', '[REDACTED]'],
    ['Escribe a jose@example.com', '[EMAIL_REDACTED]'],
    ['Llámame al +57 310 555 1234', '[PHONE_REDACTED]'],
    ['Mi cédula: 1234567890', '[IDENTIFIER_REDACTED]'],
    ['Servidor 192.168.10.42', '[PRIVATE_IP_REDACTED]'],
  ])('redacts a secret from %s', (input, expected) => {
    expect(redactSecrets(input).text).toContain(expected);
    expect(redactSecrets(input).redactionCount).toBeGreaterThan(0);
  });

  it('leaves ordinary help desk text unchanged', () => {
    const input = 'No puedo conectarme a la VPN desde esta mañana';
    expect(redactSecrets(input)).toEqual({ text: input, redactionCount: 0 });
  });

  it('does not mistake UUIDs or ticket numbers for phone numbers', () => {
    const input = 'ticket 1b105555-1234-403a-b734-cf3f08ac51a4 TCK-2026-123456';
    expect(redactSensitiveData(input).text).toBe(input);
  });

  it('is idempotent', () => {
    const once = redactSensitiveData(
      'password=[REDACTED] [EMAIL_REDACTED] [PHONE_REDACTED]',
    );
    expect(redactSecrets(once.text)).toEqual(once);
  });

  it('redacts several PII types without preserving an unsafe copy', () => {
    const result = redactSensitiveData(
      'ana@example.com +57 310 555 1234 documento 12345678 10.0.0.8',
    );
    expect(result.text).toBe(
      '[EMAIL_REDACTED] [PHONE_REDACTED] [IDENTIFIER_REDACTED] [PRIVATE_IP_REDACTED]',
    );
    expect(result.redactionCount).toBe(4);
  });

  it('supports additional personal identifier patterns', () => {
    expect(
      redactSensitiveData('employee KLAB-12345', [/KLAB-\d{5}/g]).text,
    ).toBe('employee [IDENTIFIER_REDACTED]');
  });

  it.each(['ana@example.com', '+57 310 555 1234', '123456789', 'Ana Pérez'])(
    'rejects non-opaque requester identity %s',
    (value) => expect(() => assertOpaqueRequesterId(value)).toThrow('opaque'),
  );

  it.each(['user-123', 'auth0|abc_123', 'usuario.demo'])(
    'accepts compatible opaque requester identity %s',
    (value) => expect(() => assertOpaqueRequesterId(value)).not.toThrow(),
  );
});
