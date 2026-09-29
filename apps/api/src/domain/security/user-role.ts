export const USER_ROLES = [
  'END_USER',
  'SUPPORT_AGENT',
  'APPROVER',
  'ADMIN',
  'AUDITOR',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
