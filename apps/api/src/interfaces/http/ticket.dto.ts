import { ApiProperty } from '@nestjs/swagger';
import type { OperatingSystem } from '../../application/ports/vpn-diagnostic.port.js';

export class CreateTicketDto {
  @ApiProperty({ example: 'VPN no conecta', maxLength: 200 })
  subject!: string;

  @ApiProperty({ example: 'El cliente VPN muestra un error de conexión' })
  description!: string;

  @ApiProperty({ example: 'usuario-demo' })
  requesterId!: string;
}
export class StartVpnDiagnosticDto {
  @ApiProperty({ enum: ['WINDOWS', 'MACOS', 'LINUX'], example: 'WINDOWS' })
  operatingSystem!: OperatingSystem;

  @ApiProperty({
    example: 'El cliente muestra timeout al establecer el túnel',
    description:
      'En modo mock admite SIMULATE_DNS_FAILURE, SIMULATE_TCP_UNREACHABLE y SIMULATE_TOOL_UNAVAILABLE.',
  })
  errorMessage!: string;
}

export class ProposeRemediationDto {
  @ApiProperty({
    enum: [
      'REFRESH_VPN_PROFILE',
      'RESET_VPN_CONFIGURATION',
      'DISABLE_SECURITY_CONTROLS',
    ],
    example: 'REFRESH_VPN_PROFILE',
  })
  action!:
    | 'REFRESH_VPN_PROFILE'
    | 'RESET_VPN_CONFIGURATION'
    | 'DISABLE_SECURITY_CONTROLS';

}

export class ResolveTicketDto {
  @ApiProperty({
    example: 'Perfil VPN actualizado y conectividad verificada',
  })
  resolutionSummary!: string;
}

export class ApprovalDecisionDto {
  @ApiProperty({ example: true })
  approved!: boolean;

  @ApiProperty({ example: 'Cambio autorizado por soporte' })
  reason!: string;
}

export class TicketLifecycleDto {
  @ApiProperty({ example: 'El usuario confirmó que el servicio funciona' })
  reason!: string;
}

export class TriageEntitiesDto {
  @ApiProperty({ type: String, required: false, example: 'usuario-demo' })
  affectedUser?: string;

  @ApiProperty({ type: String, required: false, example: 'corporate-vpn' })
  impactedService?: string;

  @ApiProperty({ type: String, required: false, enum: ['LOW', 'MEDIUM', 'HIGH'] })
  businessCriticality?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class TicketClassificationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  ticketId!: string;

  @ApiProperty({
    type: String,
    enum: ['ACCESS_IDENTITY', 'INFRASTRUCTURE_SOFTWARE', 'PROVISIONING_PERMISSIONS', 'OTHER'],
  })
  category!: string;

  @ApiProperty({ type: String, example: 'VPN' })
  subcategory!: string;

  @ApiProperty({ type: String, enum: ['SINGLE_USER', 'MULTIPLE_USERS', 'WIDESPREAD'] })
  impact!: string;

  @ApiProperty({ type: String, enum: ['LOW', 'MEDIUM', 'HIGH'] })
  urgency!: string;

  @ApiProperty({ type: String, enum: ['P1', 'P2', 'P3', 'P4'] })
  priority!: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 1, example: 0.94 })
  confidence!: number;

  @ApiProperty({ type: TriageEntitiesDto })
  entities!: TriageEntitiesDto;

  @ApiProperty({ type: [String], example: [] })
  missingInformation!: string[];

  @ApiProperty({ type: String, enum: ['HANDOFF_DIAGNOSTIC', 'ESCALATE_HUMAN'] })
  nextAction!: string;

  @ApiProperty({
    type: String,
    enum: [
      'SUPPORTED_AND_COMPLETE',
      'LOW_CONFIDENCE_OR_UNSUPPORTED',
      'NO_AUTOMATED_DIAGNOSTIC',
      'CRITICAL_PRIORITY',
    ],
  })
  reason!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class TicketCapabilitiesDto {
  @ApiProperty({ type: TicketClassificationDto })
  classification!: TicketClassificationDto;

  @ApiProperty({
    type: String,
    isArray: true,
    enum: ['RUN_VPN_DIAGNOSTIC', 'REQUEST_INFORMATION', 'ESCALATE_HUMAN'],
  })
  allowedActions!: string[];

  @ApiProperty({
    type: String,
    enum: [
      'VPN_DIAGNOSTIC_AVAILABLE',
      'INFORMATION_REQUIRED',
      'IDENTITY_REQUIRES_HUMAN',
      'PROVISIONING_REQUIRES_HUMAN',
      'UNSUPPORTED_REQUIRES_HUMAN',
      'CRITICAL_REQUIRES_HUMAN',
    ],
  })
  guidanceCode!: string;

  @ApiProperty({ type: String, example: 'Objetivo de primera respuesta: 4 horas.' })
  slaExpectation!: string;
}
