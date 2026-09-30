import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';
import {
  type AuthenticatedRequest,
  type UserRole,
  USER_ROLES,
} from './auth.types.js';
import {
  TOKEN_VERIFIER,
  type TokenVerifierPort,
} from '../../application/ports/token-verifier.port.js';
import { assertOpaqueRequesterId } from '../../domain/security/secret-redactor.js';

@Injectable()
export class RoleAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional()
    @Inject(TOKEN_VERIFIER)
    private readonly tokenVerifier?: TokenVerifierPort,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (process.env.AUTH_MODE === 'oidc') {
      return this.authenticateOidc(request, context);
    }
    if ((process.env.AUTH_MODE ?? 'mock') !== 'mock') {
      throw new UnauthorizedException('Authentication mode is not configured');
    }
    const userId = header(request.headers['x-user-id']);
    const roleValue = header(request.headers['x-user-role']);
    if (!userId || !isUserRole(roleValue)) {
      throw new UnauthorizedException(
        'X-User-Id and a valid X-User-Role are required',
      );
    }
    try {
      assertOpaqueRequesterId(userId);
    } catch {
      throw new UnauthorizedException(
        'Authenticated user identifier must be opaque',
      );
    }
    request.user = { id: userId, role: roleValue };

    return this.authorizeRole(context, roleValue);
  }

  private async authenticateOidc(
    request: AuthenticatedRequest,
    context: ExecutionContext,
  ): Promise<boolean> {
    const authorization = header(request.headers.authorization);
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match || !this.tokenVerifier) {
      throw new UnauthorizedException('A valid Bearer token is required');
    }
    try {
      const identity = await this.tokenVerifier.verify(match[1]);
      assertOpaqueRequesterId(identity.id);
      request.user = identity;
      return this.authorizeRole(context, identity.role);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Bearer token validation failed');
    }
  }

  private authorizeRole(context: ExecutionContext, role: UserRole): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length && !requiredRoles.includes(role)) {
      throw new ForbiddenException('Role is not allowed for this operation');
    }
    return true;
  }
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isUserRole(value: string | undefined): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}
