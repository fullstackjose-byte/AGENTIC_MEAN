import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RoleAuthorizationGuard } from './role-authorization.guard.js';
import type { TokenVerifierPort } from '../../application/ports/token-verifier.port.js';

const originalAuthMode = process.env.AUTH_MODE;

beforeEach(() => {
  process.env.AUTH_MODE = 'mock';
});

afterAll(() => {
  if (originalAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = originalAuthMode;
});

function context(headers: Record<string, string>) {
  const request = { headers };
  return {
    request,
    execution: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
    } as unknown as ExecutionContext,
  };
}

function reflector(isPublic: boolean, roles?: string[]): Reflector {
  return {
    getAllAndOverride: vi
      .fn()
      .mockReturnValueOnce(isPublic)
      .mockReturnValueOnce(roles),
  } as unknown as Reflector;
}

describe('RoleAuthorizationGuard', () => {
  it('allows public endpoints without identity headers', () => {
    const guard = new RoleAuthorizationGuard(reflector(true));
    expect(guard.canActivate(context({}).execution)).toBe(true);
  });

  it('rejects requests without an authenticated identity', () => {
    const guard = new RoleAuthorizationGuard(reflector(false));
    expect(() => guard.canActivate(context({}).execution)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an authenticated role without permission', () => {
    const guard = new RoleAuthorizationGuard(
      reflector(false, ['APPROVER']),
    );
    expect(() =>
      guard.canActivate(
        context({
          'x-user-id': 'support-1',
          'x-user-role': 'SUPPORT_AGENT',
        }).execution,
      ),
    ).toThrow(ForbiddenException);
  });

  it('attaches the authorized identity to the request', () => {
    const guard = new RoleAuthorizationGuard(
      reflector(false, ['APPROVER']),
    );
    const testContext = context({
      'x-user-id': 'approver-1',
      'x-user-role': 'APPROVER',
    });

    expect(guard.canActivate(testContext.execution)).toBe(true);
    expect(testContext.request).toHaveProperty('user', {
      id: 'approver-1',
      role: 'APPROVER',
    });
  });

  it('validates Bearer tokens in OIDC mode and ignores spoofed mock headers', async () => {
    process.env.AUTH_MODE = 'oidc';
    const verify = vi
      .fn<TokenVerifierPort['verify']>()
      .mockResolvedValue({ id: 'oidc-user', role: 'APPROVER' });
    const verifier: TokenVerifierPort = {
      verify,
    };
    const guard = new RoleAuthorizationGuard(
      reflector(false, ['APPROVER']),
      verifier,
    );
    const testContext = context({
      authorization: 'Bearer signed-token',
      'x-user-id': 'spoofed-admin',
      'x-user-role': 'ADMIN',
    });

    await expect(guard.canActivate(testContext.execution)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('signed-token');
    expect(testContext.request).toHaveProperty('user', {
      id: 'oidc-user',
      role: 'APPROVER',
    });
  });

  it('rejects invalid OIDC tokens without leaking validation details', async () => {
    process.env.AUTH_MODE = 'oidc';
    const verifier: TokenVerifierPort = {
      verify: vi.fn().mockRejectedValue(new Error('signature details')),
    };
    const guard = new RoleAuthorizationGuard(
      reflector(false, ['APPROVER']),
      verifier,
    );

    await expect(
      guard.canActivate(
        context({ authorization: 'Bearer invalid-token' }).execution,
      ),
    ).rejects.toThrow('Bearer token validation failed');
  });
});
