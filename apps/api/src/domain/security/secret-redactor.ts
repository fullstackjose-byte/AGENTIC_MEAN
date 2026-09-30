export interface RedactionResult {
  text: string;
  redactionCount: number;
}

interface RedactionRule {
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
}

const rules: readonly RedactionRule[] = [
  {
    pattern: /\b(password\s*[=:]\s*)(?!\[REDACTED\])\S+/gi,
    replacement: (_match, prefix) => `${prefix}[REDACTED]`,
  },
  {
    pattern: /\b(token\s*[=:]\s*)(?!\[REDACTED\])\S+/gi,
    replacement: (_match, prefix) => `${prefix}[REDACTED]`,
  },
  {
    pattern: /\b(Bearer\s+)(?!\[REDACTED\])\S+/gi,
    replacement: (_match, prefix) => `${prefix}[REDACTED]`,
  },
  {
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[REDACTED]',
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    pattern:
      /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
    replacement: '[PRIVATE_IP_REDACTED]',
  },
  {
    pattern:
      /\b(?:c[eé]dula|documento|identificaci[oó]n|dni|cc)\s*(?:n(?:[oº°]|úmero)?\s*)?[:#-]?\s*\d{6,15}\b/gi,
    replacement: '[IDENTIFIER_REDACTED]',
  },
  {
    pattern:
      /(?<![A-Fa-f0-9-])(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]){1,3}\d{3,4}(?![A-Fa-f0-9-])/g,
    replacement: (match) =>
      match.replace(/\d/g, '').length > 0 &&
      match.replace(/\D/g, '').length >= 7
        ? '[PHONE_REDACTED]'
        : match,
  },
];

export function redactSensitiveData(
  input: string,
  additionalIdentifierPatterns: readonly RegExp[] = [],
): RedactionResult {
  let redactionCount = 0;
  let text = input;

  const configuredRules: RedactionRule[] = additionalIdentifierPatterns.map(
    (pattern) => ({ pattern, replacement: '[IDENTIFIER_REDACTED]' }),
  );

  for (const rule of [...rules, ...configuredRules]) {
    text = text.replace(rule.pattern, (match: string, ...groups: string[]) => {
      const replacement =
        typeof rule.replacement === 'string'
          ? rule.replacement
          : rule.replacement(match, ...groups);
      if (replacement !== match) redactionCount += 1;
      return replacement;
    });
  }

  return { text, redactionCount };
}

/** Backwards-compatible name; now redacts secrets and supported PII. */
export const redactSecrets = redactSensitiveData;

export class InvalidOpaqueRequesterIdError extends Error {
  constructor() {
    super('requesterId must be an opaque internal identifier');
    this.name = 'InvalidOpaqueRequesterIdError';
  }
}

export function assertOpaqueRequesterId(value: string): void {
  const candidate = value.trim();
  const looksOpaque =
    /^[A-Za-z0-9][A-Za-z0-9._|:-]{2,119}$/.test(candidate) &&
    !/^\d{6,15}$/.test(candidate);
  if (!looksOpaque) throw new InvalidOpaqueRequesterIdError();
}
