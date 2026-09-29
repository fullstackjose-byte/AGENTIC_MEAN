import type { UserRole } from '../../domain/security/user-role.js';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface VerifiedIdentity {
  id: string;
  role: UserRole;
}

export interface TokenVerifierPort {
  verify(token: string): Promise<VerifiedIdentity>;
}
