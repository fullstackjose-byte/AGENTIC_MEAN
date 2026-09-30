import { redactSecrets } from '../../domain/security/secret-redactor.js';
import type {
  OperatingSystem,
  VpnDiagnosticResult,
} from '../../application/ports/vpn-diagnostic.port.js';

export const VPN_ENDPOINT_ALLOWLIST = ['vpn.corporate.local'] as const;

export interface VpnResourceInput {
  ticketId: string;
  endpoint: string;
  operatingSystem: OperatingSystem;
  errorMessage: string;
}

export interface VpnResourceOutput extends VpnDiagnosticResult {
  timestamp: string;
  endpoint: string;
  attempts: number;
}

export type ConnectivityProbe = (
  input: VpnResourceInput,
) => Promise<VpnDiagnosticResult>;

export async function checkVpnConnectivity(
  input: VpnResourceInput,
  probe: ConnectivityProbe = deterministicMockProbe,
  timeoutMs = 100,
): Promise<VpnResourceOutput> {
  validateInput(input);
  const safeInput = { ...input, errorMessage: redactSecrets(input.errorMessage).text };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const evidence = await withTimeout(probe(safeInput), timeoutMs);
      if (!isValidEvidence(evidence)) throw new Error('INVALID_OUTPUT');
      return {
        ...evidence,
        timestamp: new Date().toISOString(),
        endpoint: maskPrivateIp(input.endpoint),
        attempts: attempt,
      };
    } catch {
      if (attempt === 2) {
        return {
          dnsResolved: false,
          tcpReachable: false,
          latencyMs: null,
          errorCode: 'TOOL_UNAVAILABLE',
          timestamp: new Date().toISOString(),
          endpoint: maskPrivateIp(input.endpoint),
          attempts: attempt,
        };
      }
    }
  }
  throw new Error('Unreachable');
}

export async function deterministicMockProbe(
  input: VpnResourceInput,
): Promise<VpnDiagnosticResult> {
  const scenario = input.errorMessage.toUpperCase();
  if (scenario.includes('SIMULATE_TIMEOUT')) {
    return new Promise(() => undefined);
  }
  if (scenario.includes('SIMULATE_INVALID_OUTPUT')) {
    return { dnsResolved: true } as VpnDiagnosticResult;
  }
  if (scenario.includes('SIMULATE_TOOL_UNAVAILABLE')) {
    throw new Error('Tool unavailable');
  }
  if (scenario.includes('SIMULATE_DNS_FAILURE')) {
    return {
      dnsResolved: false,
      tcpReachable: false,
      latencyMs: null,
      errorCode: 'DNS_FAILURE',
    };
  }
  if (scenario.includes('SIMULATE_TCP_UNREACHABLE')) {
    return {
      dnsResolved: true,
      tcpReachable: false,
      latencyMs: null,
      errorCode: 'TCP_UNREACHABLE',
    };
  }
  return {
    dnsResolved: true,
    tcpReachable: true,
    latencyMs: 42,
    errorCode: null,
  };
}

export function maskPrivateIp(value: string): string {
  return value.replace(
    /\b(10\.\d+\.\d+|192\.168\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+)\.\d+\b/g,
    '$1.xxx',
  );
}

function validateInput(input: VpnResourceInput): void {
  if (!input.ticketId || !input.errorMessage.trim()) {
    throw new Error('Invalid VPN diagnostic input');
  }
  if (!VPN_ENDPOINT_ALLOWLIST.includes(input.endpoint as never)) {
    throw new Error('VPN endpoint is not allowlisted');
  }
  if (!['WINDOWS', 'MACOS', 'LINUX'].includes(input.operatingSystem)) {
    throw new Error('Unsupported operating system');
  }
}

function isValidEvidence(value: VpnDiagnosticResult): boolean {
  return (
    typeof value?.dnsResolved === 'boolean' &&
    typeof value?.tcpReachable === 'boolean' &&
    (value.latencyMs === null ||
      (Number.isInteger(value.latencyMs) && value.latencyMs >= 0)) &&
    ['DNS_FAILURE', 'TCP_UNREACHABLE', 'TOOL_UNAVAILABLE', null].includes(
      value.errorCode,
    )
  );
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
