import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from 'jose';
import type {
  TokenVerifierPort,
  VerifiedIdentity,
} from '../../application/ports/token-verifier.port.js';
import { USER_ROLES, type UserRole } from '../../domain/security/user-role.js';

export interface OidcVerifierConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
  rolesClaim: string;
  roleMap: Readonly<Record<string, UserRole>>;
  algorithms: string[];
}

const ROLE_PRECEDENCE: readonly UserRole[] = [
  'ADMIN',
  'APPROVER',
  'SUPPORT_AGENT',
  'AUDITOR',
  'END_USER',
];

export class OidcTokenVerifier implements TokenVerifierPort {
  private readonly keySet: JWTVerifyGetKey;

  constructor(
    private readonly config: OidcVerifierConfig,
    keySet?: JWTVerifyGetKey,
  ) {
    this.keySet = keySet ?? createRemoteJWKSet(new URL(config.jwksUri));
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    const { payload } = await jwtVerify(token, this.keySet, {
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithms: this.config.algorithms,
    });
    if (!payload.sub) throw new Error('OIDC token is missing sub');
    const role = resolveRole(
      nestedClaim(payload, this.config.rolesClaim),
      this.config.roleMap,
    );
    if (!role) throw new Error('OIDC token has no recognized role');
    return { id: payload.sub, role };
  }
}

export function oidcVerifierFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): TokenVerifierPort {
  if (environment.AUTH_MODE !== 'oidc') {
    return {
      verify: async () => {
        throw new Error('OIDC authentication is disabled');
      },
    };
  }
  const issuer = required(environment, 'OIDC_ISSUER');
  const audience = required(environment, 'OIDC_AUDIENCE');
  const jwksUri = required(environment, 'OIDC_JWKS_URI');
  return new OidcTokenVerifier({
    issuer,
    audience,
    jwksUri,
    rolesClaim: environment.OIDC_ROLES_CLAIM ?? 'roles',
    roleMap: parseRoleMap(environment.OIDC_ROLE_MAP),
    algorithms: (environment.OIDC_ALLOWED_ALGORITHMS ?? 'RS256')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  });
}

function nestedClaim(payload: JWTPayload, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, payload);
}

function resolveRole(
  claim: unknown,
  roleMap: Readonly<Record<string, UserRole>>,
): UserRole | undefined {
  const externalRoles = Array.isArray(claim) ? claim : [claim];
  const roles = externalRoles
    .filter((value): value is string => typeof value === 'string')
    .map((value) => roleMap[value] ?? value)
    .filter((value): value is UserRole =>
      USER_ROLES.includes(value as UserRole),
    );
  return ROLE_PRECEDENCE.find((role) => roles.includes(role));
}

function parseRoleMap(value: string | undefined): Record<string, UserRole> {
  if (!value) return {};
  const parsed = JSON.parse(value) as Record<string, unknown>;
  for (const [external, role] of Object.entries(parsed)) {
    if (!USER_ROLES.includes(role as UserRole)) {
      throw new Error(`OIDC_ROLE_MAP has invalid role for ${external}`);
    }
  }
  return parsed as Record<string, UserRole>;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (!value) throw new Error(`${name} is required when AUTH_MODE=oidc`);
  return value;
}
