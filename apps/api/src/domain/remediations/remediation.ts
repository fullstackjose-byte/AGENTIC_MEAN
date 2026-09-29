export type RemediationAction =
  | 'REFRESH_VPN_PROFILE'
  | 'RESET_VPN_CONFIGURATION'
  | 'DISABLE_SECURITY_CONTROLS';
export type RemediationRisk = 'LOW' | 'MEDIUM' | 'PROHIBITED';
export type RemediationStatus =
  | 'PENDING_APPROVAL'
  | 'EXECUTED'
  | 'REJECTED'
  | 'FAILED';
export type VerificationStatus = 'NOT_RUN' | 'PASSED' | 'FAILED';

export interface Remediation {
  id: string;
  ticketId: string;
  action: RemediationAction;
  risk: RemediationRisk;
  status: RemediationStatus;
  verificationStatus: VerificationStatus;
  requestedBy: string;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
