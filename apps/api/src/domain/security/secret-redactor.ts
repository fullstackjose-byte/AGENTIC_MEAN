export interface RedactionResult {
  text: string;
  redactionCount: number;
}

const secretPatterns: readonly RegExp[] = [
  /\b(password\s*[=:]\s*)(?!\[REDACTED\])\S+/gi,
  /\b(token\s*[=:]\s*)(?!\[REDACTED\])\S+/gi,
  /\b(Bearer\s+)(?!\[REDACTED\])\S+/gi,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{10,}\b/g,
];

export function redactSecrets(input: string): RedactionResult {
  let redactionCount = 0;
  let text = input;

  for (const pattern of secretPatterns) {
    text = text.replace(pattern, (_match: string, prefix?: string) => {
      redactionCount += 1;
      return prefix ? `${prefix}[REDACTED]` : '[REDACTED]';
    });
  }

  return { text, redactionCount };
}
