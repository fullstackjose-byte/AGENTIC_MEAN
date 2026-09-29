import { describe, expect, it } from 'vitest';
import { calculatePriority } from './priority-policy.js';

describe('priority policy', () => {
  it.each([
    ['WIDESPREAD', 'HIGH', 'P1'],
    ['MULTIPLE_USERS', 'HIGH', 'P2'],
    ['SINGLE_USER', 'MEDIUM', 'P3'],
    ['SINGLE_USER', 'LOW', 'P4'],
  ] as const)('maps %s/%s to %s', (impact, urgency, expected) => {
    expect(calculatePriority({ impact, urgency })).toBe(expected);
  });

  it('does not allow low urgency to downgrade a widespread outage below P2', () => {
    expect(
      calculatePriority({ impact: 'WIDESPREAD', urgency: 'LOW' }),
    ).toBe('P2');
  });
});
