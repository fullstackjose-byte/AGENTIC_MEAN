export const VPN_DIAGNOSTIC_PORT = Symbol('VPN_DIAGNOSTIC_PORT');

export type OperatingSystem = 'WINDOWS' | 'MACOS' | 'LINUX';

export interface VpnDiagnosticInput {
  operatingSystem: OperatingSystem;
  errorMessage: string;
}

export interface VpnDiagnosticResult {
  dnsResolved: boolean;
  tcpReachable: boolean;
  latencyMs: number | null;
  errorCode: 'DNS_FAILURE' | 'TCP_UNREACHABLE' | 'TOOL_UNAVAILABLE' | null;
}

export interface VpnDiagnosticPort {
  check(input: VpnDiagnosticInput): Promise<VpnDiagnosticResult>;
}
