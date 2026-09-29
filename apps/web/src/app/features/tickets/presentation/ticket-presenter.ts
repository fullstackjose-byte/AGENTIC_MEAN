import { HttpErrorResponse } from '@angular/common/http';
import type {
  DiagnosticResult,
  Remediation,
  TicketCapabilities,
  TicketStatus,
} from '../domain/ticket.model';

const STATUS: Record<TicketStatus, string> = {
  NEW: 'Recibimos la solicitud y está pendiente de clasificación.',
  CLASSIFIED: 'La solicitud fue clasificada y tiene un siguiente paso disponible.',
  IN_DIAGNOSIS: 'Estamos verificando la causa con evidencia técnica.',
  PENDING_USER: 'Necesitamos información adicional del usuario.',
  PENDING_APPROVAL: 'La acción necesita aprobación antes de ejecutarse.',
  IN_REMEDIATION: 'La acción aprobada está en proceso de verificación.',
  ESCALATED: 'Un especialista humano debe continuar la atención.',
  RESOLVED: 'La solución fue ejecutada y verificada.',
  CLOSED: 'El ticket fue cerrado después de confirmar la solución.',
  REOPENED: 'El problema persiste y se iniciará una nueva revisión.',
  CANCELLED: 'La solicitud fue cancelada.',
};

export function statusMessage(status: TicketStatus): string {
  return STATUS[status];
}

export function diagnosticMessage(result: DiagnosticResult): string {
  return {
    CONNECTIVITY_OK: 'La conexión básica funciona correctamente.',
    DNS_FAILURE: 'No fue posible resolver el nombre del servicio VPN.',
    ENDPOINT_UNREACHABLE: 'El servicio VPN no respondió a la prueba de conectividad.',
    INCONCLUSIVE: 'No se obtuvo evidencia suficiente y el caso será revisado por una persona.',
  }[result.outcome];
}

export function recommendationMessage(code: string): string {
  return (
    {
      VERIFY_CLIENT_CONFIGURATION:
        'El siguiente paso es revisar la configuración del cliente VPN.',
      CHECK_DNS_CONFIGURATION:
        'El siguiente paso es revisar la configuración de nombres de red.',
      VERIFY_NETWORK_OR_SERVICE:
        'El siguiente paso es validar la red y la disponibilidad del servicio.',
      ESCALATE_HUMAN: 'Un especialista continuará el diagnóstico.',
    } as Record<string, string>
  )[code] ?? 'El equipo de soporte revisará el siguiente paso.';
}

export function remediationMessage(remediation: Remediation): string {
  if (remediation.status === 'PENDING_APPROVAL') {
    return 'La acción necesita aprobación antes de ejecutarse.';
  }
  if (remediation.status === 'REJECTED') {
    return 'La acción fue rechazada y no se ejecutó.';
  }
  if (remediation.verificationStatus === 'PASSED') {
    return 'La acción se ejecutó y su resultado fue verificado.';
  }
  return 'La acción no pudo verificarse; soporte debe revisar el caso.';
}

export function remediationActionMessage(action: string): string {
  return (
    {
      REFRESH_VPN_PROFILE: 'Actualizar el perfil VPN',
      RESET_VPN_CONFIGURATION: 'Restablecer la configuración VPN',
      DISABLE_SECURITY_CONTROLS: 'Acción de seguridad no permitida',
    } as Record<string, string>
  )[action] ?? 'Acción técnica de soporte';
}

export function categoryMessage(category: string): string {
  return (
    {
      ACCESS_IDENTITY: 'Acceso e identidad',
      INFRASTRUCTURE_SOFTWARE: 'Infraestructura y software local',
      PROVISIONING_PERMISSIONS: 'Aprovisionamiento y permisos',
      OTHER: 'Solicitud por revisar',
    } as Record<string, string>
  )[category] ?? 'Solicitud por revisar';
}

export function guidanceMessage(capabilities: TicketCapabilities): string {
  return {
    VPN_DIAGNOSTIC_AVAILABLE:
      'Podemos ejecutar un diagnóstico seguro de conectividad VPN.',
    INFORMATION_REQUIRED: `Antes de continuar necesitamos: ${capabilities.classification.missingInformation.join(', ')}.`,
    IDENTITY_REQUIRES_HUMAN:
      'Por seguridad, un especialista de identidad revisará la cuenta sin solicitar contraseñas.',
    PROVISIONING_REQUIRES_HUMAN:
      'Un aprobador revisará la solicitud de acceso o licencia.',
    UNSUPPORTED_REQUIRES_HUMAN:
      'La solicitud requiere revisión humana porque no hay una automatización segura disponible.',
    CRITICAL_REQUIRES_HUMAN:
      'La prioridad es crítica y requiere atención humana inmediata.',
  }[capabilities.guidanceCode];
}

export function problemMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const problem = error.error as
    | { detail?: unknown; correlationId?: unknown }
    | undefined;
  const detail = typeof problem?.detail === 'string' ? problem.detail : fallback;
  const correlationId =
    typeof problem?.correlationId === 'string'
      ? problem.correlationId
      : error.headers.get('X-Correlation-Id');
  return correlationId ? `${detail} Seguimiento: ${correlationId}.` : detail;
}
