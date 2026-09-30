import { describe, expect, it, vi } from 'vitest';
import {
  checkVpnConnectivity,
  maskPrivateIp,
  type VpnResourceInput,
} from './check-vpn-connectivity.js';

const input: VpnResourceInput = {
  ticketId: '11111111-1111-4111-8111-111111111111',
  endpoint: 'vpn.corporate.local',
  operatingSystem: 'WINDOWS',
  errorMessage: 'No conecta',
};

describe('checkVpnConnectivity skill resource', () => {
  it('returns validated deterministic evidence', async () => {
    await expect(checkVpnConnectivity(input)).resolves.toMatchObject({
      dnsResolved: true,
      tcpReachable: true,
      latencyMs: 42,
      attempts: 1,
    });
  });

  it('retries only once and returns TOOL_UNAVAILABLE on failure', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('transient'));
    await expect(checkVpnConnectivity(input, probe, 5)).resolves.toMatchObject({
      errorCode: 'TOOL_UNAVAILABLE',
      attempts: 2,
    });
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it.each(['SIMULATE_TIMEOUT', 'SIMULATE_INVALID_OUTPUT'])(
    'escalates %s as unavailable evidence',
    async (scenario) => {
      await expect(
        checkVpnConnectivity({ ...input, errorMessage: scenario }, undefined, 5),
      ).resolves.toMatchObject({ errorCode: 'TOOL_UNAVAILABLE', attempts: 2 });
    },
  );

  it('rejects endpoints outside the allowlist and masks private IPs', async () => {
    await expect(
      checkVpnConnectivity({ ...input, endpoint: 'evil.example.com' }),
    ).rejects.toThrow('allowlisted');
    expect(maskPrivateIp('gateway 192.168.20.44')).toBe(
      'gateway 192.168.20.xxx',
    );
  });
});
