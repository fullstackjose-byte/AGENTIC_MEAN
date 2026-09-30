import { redactSensitiveData } from '../../domain/security/secret-redactor.js';

const SENSITIVE_KEY = /password|token|authorization|cookie|secret|api[-_]?key/i;

export function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveData(value).text;
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeLogValue(item),
    ]),
  );
}
