import { describe, expect, it } from 'vitest';
import { MockVpnDiagnosticAdapter } from './mock-vpn-diagnostic.adapter.js';

describe('MockVpnDiagnosticAdapter', () => {
  const adapter = new MockVpnDiagnosticAdapter();

  it('returns deterministic healthy connectivity by default', async () => {
    await expect(
      adapter.check({
        operatingSystem: 'WINDOWS',
        errorMessage: 'El cliente no completa la conexion',
      }),
    ).resolves.toEqual({
      dnsResolved: true,
      tcpReachable: true,
      latencyMs: 42,
      errorCode: null,
    });
  });

  it('simulates DNS failure without using the network', async () => {
    await expect(
      adapter.check({
        operatingSystem: 'LINUX',
        errorMessage: 'SIMULATE_DNS_FAILURE',
      }),
    ).resolves.toMatchObject({
      dnsResolved: false,
      tcpReachable: false,
      errorCode: 'DNS_FAILURE',
    });
  });

  it('simulates an unavailable tool for escalation testing', async () => {
    await expect(
      adapter.check({
        operatingSystem: 'MACOS',
        errorMessage: 'SIMULATE_TOOL_UNAVAILABLE',
      }),
    ).resolves.toMatchObject({ errorCode: 'TOOL_UNAVAILABLE' });
  });
});
