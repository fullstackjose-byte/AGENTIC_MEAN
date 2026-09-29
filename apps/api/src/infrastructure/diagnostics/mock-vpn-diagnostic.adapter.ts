import type {
  VpnDiagnosticInput,
  VpnDiagnosticPort,
  VpnDiagnosticResult,
} from '../../application/ports/vpn-diagnostic.port.js';

export class MockVpnDiagnosticAdapter implements VpnDiagnosticPort {
  check(input: VpnDiagnosticInput): Promise<VpnDiagnosticResult> {
    const scenario = input.errorMessage.toUpperCase();
    if (scenario.includes('SIMULATE_TOOL_UNAVAILABLE')) {
      return Promise.resolve({
        dnsResolved: false,
        tcpReachable: false,
        latencyMs: null,
        errorCode: 'TOOL_UNAVAILABLE',
      });
    }
    if (scenario.includes('SIMULATE_DNS_FAILURE')) {
      return Promise.resolve({
        dnsResolved: false,
        tcpReachable: false,
        latencyMs: null,
        errorCode: 'DNS_FAILURE',
      });
    }
    if (scenario.includes('SIMULATE_TCP_UNREACHABLE')) {
      return Promise.resolve({
        dnsResolved: true,
        tcpReachable: false,
        latencyMs: null,
        errorCode: 'TCP_UNREACHABLE',
      });
    }
    return Promise.resolve({
      dnsResolved: true,
      tcpReachable: true,
      latencyMs: 42,
      errorCode: null,
    });
  }
}
