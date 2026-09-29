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
