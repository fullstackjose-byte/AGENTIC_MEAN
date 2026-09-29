import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiExtraModels,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CreateTicketUseCase } from '../../application/tickets/create-ticket.use-case.js';
import {
  GetTicketUseCase,
  TicketNotFoundError,
} from '../../application/tickets/get-ticket.use-case.js';
import {
  InvalidTicketQueryError,
  ListTicketsUseCase,
} from '../../application/tickets/list-tickets.use-case.js';
import { TriageTicketUseCase } from '../../application/triage/triage-ticket.use-case.js';
import {
  StartVpnDiagnosticUseCase,
  UnsupportedDiagnosticError,
} from '../../application/diagnostics/start-vpn-diagnostic.use-case.js';
import {
  CreateTicketDto,
  ProposeRemediationDto,
  ResolveTicketDto,
  StartVpnDiagnosticDto,
  TicketLifecycleDto,
  TicketCapabilitiesDto,
  TicketClassificationDto,
} from './ticket.dto.js';
import {
  ProhibitedRemediationError,
  ProposeRemediationUseCase,
} from '../../application/remediations/propose-remediation.use-case.js';
import { ResolveTicketUseCase } from '../../application/remediations/resolve-ticket.use-case.js';
import { CloseTicketUseCase } from '../../application/tickets/close-ticket.use-case.js';
import { ReopenTicketUseCase } from '../../application/tickets/reopen-ticket.use-case.js';
import { GetTicketTimelineUseCase } from '../../application/tickets/get-ticket-timeline.use-case.js';
import { Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  ClassificationNotFoundError,
  GetTicketCapabilitiesUseCase,
} from '../../application/triage/get-ticket-capabilities.use-case.js';

@ApiTags('Tickets')
@ApiSecurity('user-id')
@ApiSecurity('user-role')
@ApiExtraModels(TicketClassificationDto, TicketCapabilitiesDto)
@Controller('api/v1/tickets')
export class TicketsController {
  constructor(
    @Inject(CreateTicketUseCase)
    private readonly createTicket: CreateTicketUseCase,
    @Inject(GetTicketUseCase)
    private readonly getTicket: GetTicketUseCase,
    @Inject(ListTicketsUseCase)
    private readonly listTickets: ListTicketsUseCase,
    @Inject(TriageTicketUseCase)
    private readonly triageTicket: TriageTicketUseCase,
    @Inject(GetTicketCapabilitiesUseCase)
    private readonly getCapabilities: GetTicketCapabilitiesUseCase,
    @Inject(StartVpnDiagnosticUseCase)
    private readonly startVpnDiagnostic: StartVpnDiagnosticUseCase,
    @Inject(ProposeRemediationUseCase)
    private readonly proposeRemediation: ProposeRemediationUseCase,
    @Inject(ResolveTicketUseCase)
    private readonly resolveTicket: ResolveTicketUseCase,
    @Inject(CloseTicketUseCase)
    private readonly closeTicket: CloseTicketUseCase,
    @Inject(ReopenTicketUseCase)
    private readonly reopenTicket: ReopenTicketUseCase,
    @Inject(GetTicketTimelineUseCase)
    private readonly getTimeline: GetTicketTimelineUseCase,
  ) {}

  @Post()
  @Roles('END_USER', 'SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Crear un ticket sanitizado' })
  async create(
    @Body() body: CreateTicketDto,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return await this.createTicket.execute({
        subject: body.subject,
        description: body.description,
        requesterId:
          request.user.role === 'END_USER' ? request.user.id : body.requesterId,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid ticket',
      );
    }
  }

  @Post(':id/closure')
  @Roles('SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Cerrar un ticket resuelto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  close(
    @Param('id') id: string,
    @Body() body: TicketLifecycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runLifecycle(() =>
      this.closeTicket.execute(id, {
        reason: body.reason,
        actorId: request.user.id,
      }),
    );
  }

  @Post(':id/reopen')
  @Roles('END_USER', 'SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Reabrir un ticket resuelto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  reopen(
    @Param('id') id: string,
    @Body() body: TicketLifecycleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runLifecycle(async () => {
      await this.assertTicketAccess(id, request);
      return this.reopenTicket.execute(id, {
        reason: body.reason,
        actorId: request.user.id,
      });
    });
  }

  @Post(':id/remediations')
  @Roles('SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Proponer o ejecutar una remediación allowlisted' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remediate(
    @Param('id') id: string,
    @Body() body: ProposeRemediationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return await this.proposeRemediation.execute(id, {
        action: body.action,
        requestedBy: request.user.id,
      });
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ProhibitedRemediationError || error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(':id/resolution')
  @Roles('SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Resolver un ticket con verificación exitosa' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async resolve(@Param('id') id: string, @Body() body: ResolveTicketDto) {
    try {
      return await this.resolveTicket.execute(id, body);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ForbiddenException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid resolution',
      );
    }
  }

  @Post(':id/classifications')
  @Roles('SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Clasificar y priorizar un ticket' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(TicketClassificationDto) },
        {
          type: 'object',
          required: ['ticketStatus', 'capabilities'],
          properties: {
            ticketStatus: {
              type: 'string',
              enum: ['CLASSIFIED', 'ESCALATED'],
            },
            capabilities: { $ref: getSchemaPath(TicketCapabilitiesDto) },
          },
        },
      ],
    },
  })
  async classify(@Param('id') id: string) {
    try {
      return await this.triageTicket.execute(id);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid triage result',
      );
    }
  }

  @Post(':id/diagnostics')
  @Roles('SUPPORT_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Ejecutar diagnóstico seguro de conectividad VPN' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async diagnose(
    @Param('id') id: string,
    @Body() body: StartVpnDiagnosticDto,
  ) {
    try {
      return await this.startVpnDiagnostic.execute(id, body);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UnsupportedDiagnosticError || error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get()
  @Roles('END_USER', 'SUPPORT_AGENT', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Listar y filtrar tickets con paginación por cursor' })
  @ApiQuery({ name: 'limit', required: false, example: 20, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor opaco devuelto por pageInfo.nextCursor' })
  @ApiQuery({ name: 'status', required: false, enum: ['NEW', 'CLASSIFIED', 'IN_DIAGNOSIS', 'PENDING_USER', 'PENDING_APPROVAL', 'IN_REMEDIATION', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['P1', 'P2', 'P3', 'P4'] })
  @ApiQuery({ name: 'q', required: false, description: 'Busca en asunto o número' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('q') search?: string,
  ) {
    try {
      return await this.listTickets.execute({
        limit: limit === undefined ? undefined : Number(limit),
        cursor,
        status,
        priority,
        search,
        requesterId:
          request.user.role === 'END_USER' ? request.user.id : undefined,
      });
    } catch (error) {
      if (error instanceof InvalidTicketQueryError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get(':id/timeline')
  @Roles('END_USER', 'SUPPORT_AGENT', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Consultar la línea de tiempo auditable' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async timeline(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.assertTicketAccess(id, request);
    return this.getTimeline.execute(id);
  }

  @Get(':id/capabilities')
  @Roles('END_USER', 'SUPPORT_AGENT', 'ADMIN', 'AUDITOR')
  @ApiOperation({
    summary: 'Consultar clasificación y acciones permitidas por el backend',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TicketCapabilitiesDto })
  async capabilities(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.assertTicketAccess(id, request);
    try {
      return await this.getCapabilities.execute(id);
    } catch (error) {
      if (error instanceof ClassificationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Get(':id')
  @Roles('END_USER', 'SUPPORT_AGENT', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Consultar un ticket por ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async get(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      const ticket = await this.getTicket.execute(id);
      if (
        request.user.role === 'END_USER' &&
        ticket.requesterId !== request.user.id
      ) {
        throw new ForbiddenException('Ticket belongs to another requester');
      }
      return ticket;
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  private async runLifecycle(operation: () => Promise<unknown>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ForbiddenException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid lifecycle operation',
      );
    }
  }

  private async assertTicketAccess(
    ticketId: string,
    request: AuthenticatedRequest,
  ): Promise<void> {
    if (request.user.role !== 'END_USER') return;
    const ticket = await this.getTicket.execute(ticketId);
    if (ticket.requesterId !== request.user.id) {
      throw new ForbiddenException('Ticket belongs to another requester');
    }
  }
}
