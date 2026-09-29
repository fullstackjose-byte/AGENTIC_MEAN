import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateTicketInput,
  Ticket,
  TicketClassification,
  DiagnosticResult,
  OperatingSystem,
  Remediation,
  RemediationAction,
  AuditEvent,
  TicketConnection,
  TicketFilters,
} from '../domain/ticket.model';
import { HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TicketsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'http://localhost:3000/api/v1/tickets';

  list(filters: TicketFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<TicketConnection>(
      this.endpoint,
      { ...this.auth('SUPPORT_AGENT', 'support-demo'), params },
    );
  }

  create(input: CreateTicketInput) {
    return this.http.post<Ticket>(
      this.endpoint,
      input,
      this.auth('END_USER', input.requesterId),
    );
  }

  triage(ticketId: string) {
    return this.http.post<TicketClassification>(
      `${this.endpoint}/${ticketId}/classifications`,
      {},
      this.auth('SUPPORT_AGENT', 'support-demo'),
    );
  }

  diagnose(
    ticketId: string,
    input: { operatingSystem: OperatingSystem; errorMessage: string },
  ) {
    return this.http.post<DiagnosticResult>(
      `${this.endpoint}/${ticketId}/diagnostics`,
      input,
      this.auth('SUPPORT_AGENT', 'support-demo'),
    );
  }

  remediate(
    ticketId: string,
    input: { action: RemediationAction; requestedBy: string },
  ) {
    return this.http.post<Remediation>(
      `${this.endpoint}/${ticketId}/remediations`,
      input,
      this.auth('SUPPORT_AGENT', 'support-demo'),
    );
  }

  pendingRemediations() {
    return this.http.get<Remediation[]>(
      'http://localhost:3000/api/v1/remediations/pending',
      this.auth('APPROVER', 'approver-demo'),
    );
  }

  decideRemediation(
    remediationId: string,
    input: { approved: boolean; actorId: string; reason: string },
  ) {
    return this.http.post<Remediation>(
      `http://localhost:3000/api/v1/remediations/${remediationId}/approval`,
      input,
      this.auth('APPROVER', 'approver-demo'),
    );
  }

  resolve(ticketId: string, resolutionSummary: string) {
    return this.http.post<{ ticketId: string; status: 'RESOLVED' }>(
      `${this.endpoint}/${ticketId}/resolution`,
      { resolutionSummary },
      this.auth('SUPPORT_AGENT', 'support-demo'),
    );
  }

  timeline(ticketId: string) {
    return this.http.get<AuditEvent[]>(
      `${this.endpoint}/${ticketId}/timeline`,
      this.auth('AUDITOR', 'auditor-demo'),
    );
  }

  close(ticketId: string, input: { actorId: string; reason: string }) {
    return this.http.post<{ ticketId: string; status: 'CLOSED' }>(
      `${this.endpoint}/${ticketId}/closure`,
      input,
      this.auth('SUPPORT_AGENT', 'support-demo'),
    );
  }

  reopen(ticketId: string, input: { actorId: string; reason: string }) {
    return this.http.post<{ ticketId: string; status: 'REOPENED' }>(
      `${this.endpoint}/${ticketId}/reopen`,
      input,
      this.auth('END_USER', 'usuario-demo'),
    );
  }

  private auth(role: string, userId: string) {
    return {
      headers: new HttpHeaders({
        'X-User-Id': userId,
        'X-User-Role': role,
      }),
    };
  }
}
