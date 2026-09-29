import { describe, expect, it } from 'vitest';
import {
  assertTicketTransition,
  canTransitionTicket,
  InvalidTicketTransitionError,
} from './ticket-state-machine.js';

describe('ticket state machine', () => {
  it.each([
    ['NEW', 'CLASSIFIED'],
    ['CLASSIFIED', 'IN_DIAGNOSIS'],
    ['IN_DIAGNOSIS', 'IN_REMEDIATION'],
    ['IN_REMEDIATION', 'RESOLVED'],
    ['RESOLVED', 'CLOSED'],
    ['RESOLVED', 'REOPENED'],
    ['REOPENED', 'IN_DIAGNOSIS'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionTicket(from, to)).toBe(true);
    expect(() => assertTicketTransition(from, to)).not.toThrow();
  });

  it.each([
    ['NEW', 'RESOLVED'],
    ['CLASSIFIED', 'CLOSED'],
    ['IN_DIAGNOSIS', 'CLOSED'],
    ['CLOSED', 'IN_DIAGNOSIS'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransitionTicket(from, to)).toBe(false);
    expect(() => assertTicketTransition(from, to)).toThrow(
      InvalidTicketTransitionError,
    );
  });
});
