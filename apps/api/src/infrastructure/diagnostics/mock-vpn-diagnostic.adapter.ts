import type {
  VpnDiagnosticInput,
  VpnDiagnosticPort,
  VpnDiagnosticResult,
} from '../../application/ports/vpn-diagnostic.port.js';
import { checkVpnConnectivity } from './vpn-connectivity-resource.js';

export class MockVpnDiagnosticAdapter implements VpnDiagnosticPort {
  async check(input: VpnDiagnosticInput): Promise<VpnDiagnosticResult> {
    const result = await checkVpnConnectivity(
      {
        ticketId: 'runtime-ticket',
        endpoint: 'vpn.corporate.local',
        ...input,
      },
      undefined,
      20,
    );
    return {
      dnsResolved: result.dnsResolved,
      tcpReachable: result.tcpReachable,
      latencyMs: result.latencyMs,
      errorCode: result.errorCode,
    };
  }
}
