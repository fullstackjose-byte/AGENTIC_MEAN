import type { Request } from 'express';
import type { UserRole } from '../../domain/security/user-role.js';
export { USER_ROLES, type UserRole } from '../../domain/security/user-role.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
