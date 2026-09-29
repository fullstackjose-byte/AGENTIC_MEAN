import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApproveRemediationUseCase,
  RemediationNotFoundError,
} from '../../application/remediations/approve-remediation.use-case.js';
import { ListPendingRemediationsUseCase } from '../../application/remediations/list-pending-remediations.use-case.js';
import { ApprovalDecisionDto } from './ticket.dto.js';
import { Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

@ApiTags('Remediations')
@ApiSecurity('user-id')
@ApiSecurity('user-role')
@Controller('api/v1/remediations')
export class RemediationsController {
  constructor(
    @Inject(ApproveRemediationUseCase)
    private readonly approveRemediation: ApproveRemediationUseCase,
    @Inject(ListPendingRemediationsUseCase)
    private readonly listPending: ListPendingRemediationsUseCase,
  ) {}

  @Get('pending')
  @Roles('APPROVER', 'ADMIN')
  @ApiOperation({ summary: 'Listar remediaciones pendientes de aprobación' })
  pending() {
    return this.listPending.execute();
  }

  @Post(':id/approval')
  @Roles('APPROVER', 'ADMIN')
  @ApiOperation({ summary: 'Aprobar o rechazar una remediación' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async approve(
    @Param('id') id: string,
    @Body() body: ApprovalDecisionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return await this.approveRemediation.execute(id, {
        approved: body.approved,
        reason: body.reason,
        actorId: request.user.id,
      });
    } catch (error) {
      if (error instanceof RemediationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid approval',
      );
    }
  }
}
