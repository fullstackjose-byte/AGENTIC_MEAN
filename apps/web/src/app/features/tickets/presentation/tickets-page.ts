import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  DiagnosticResult,
  AuditEvent,
  OperatingSystem,
  Remediation,
  RemediationAction,
  Ticket,
  TicketFilters,
  TicketPriority,
  TicketStatus,
  TicketCapabilities,
} from '../domain/ticket.model';
import { TicketsApiService } from '../infrastructure/tickets-api.service';
import type { Observable } from 'rxjs';
import { RequestTrackingService } from '../../../core/observability/request-tracking.service';
import {
  diagnosticMessage,
  categoryMessage,
  guidanceMessage,
  problemMessage,
  recommendationMessage,
  remediationMessage,
  remediationActionMessage,
  statusMessage,
} from './ticket-presenter';

@Component({
  selector: 'app-tickets-page',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './tickets-page.html',
  styleUrl: './tickets-page.scss',
})
export class TicketsPage implements OnInit {
  private readonly api = inject(TicketsApiService);
  protected readonly tracking = inject(RequestTrackingService);

  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly classifyingId = signal<string | null>(null);
  protected readonly diagnosingId = signal<string | null>(null);
  protected readonly diagnostics = signal<Record<string, DiagnosticResult>>({});
  protected readonly remediations = signal<Record<string, Remediation>>({});
  protected readonly pendingRemediations = signal<Remediation[]>([]);
  protected readonly remediationBusyId = signal<string | null>(null);
  protected readonly timelines = signal<Record<string, AuditEvent[]>>({});
  protected readonly lifecycleBusyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly capabilities = signal<Record<string, TicketCapabilities>>({});
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasNextPage = signal(false);
  private readonly filters = signal<TicketFilters>({ limit: 20 });

  protected readonly form = new FormGroup({
    subject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    requesterId: new FormControl('usuario-demo', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    this.load();
    this.loadPendingRemediations();
  }

  protected load(append = false): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({
      ...this.filters(),
      cursor: append ? this.nextCursor() ?? undefined : undefined,
    }).subscribe({
      next: (connection) => {
        this.tickets.update((current) =>
          append ? [...current, ...connection.items] : connection.items,
        );
        this.nextCursor.set(connection.pageInfo.nextCursor);
        this.hasNextPage.set(connection.pageInfo.hasNextPage);
        for (const ticket of connection.items) {
          if (ticket.status !== 'NEW') this.loadCapabilities(ticket.id);
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(problemMessage(error, 'No fue posible consultar los tickets.'));
        this.loading.set(false);
      },
    });
  }

  protected applyFilters(search: string, status: string, priority: string): void {
    this.filters.set({
      limit: 20,
      q: search.trim() || undefined,
      status: (status || undefined) as TicketStatus | undefined,
      priority: (priority || undefined) as TicketPriority | undefined,
    });
    this.load();
  }

  protected loadMore(): void {
    if (this.hasNextPage() && !this.loading()) this.load(true);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.create(this.form.getRawValue()).subscribe({
      next: (ticket) => {
        this.tickets.update((tickets) => [ticket, ...tickets]);
        this.form.controls.subject.reset('');
        this.form.controls.description.reset('');
        this.saving.set(false);
        this.success.set(`El ticket ${ticket.number} fue creado correctamente.`);
      },
      error: (error) => {
        this.error.set(problemMessage(error, 'No fue posible crear el ticket.'));
        this.saving.set(false);
      },
    });
  }

  protected classify(ticketId: string): void {
    if (this.classifyingId()) return;
    this.classifyingId.set(ticketId);
    this.error.set(null);
    this.success.set(null);
    this.api.triage(ticketId).subscribe({
      next: (classification) => {
        this.tickets.update((tickets) =>
          tickets.map((ticket) =>
            ticket.id === ticketId
              ? {
                  ...ticket,
                  priority: classification.priority,
                  status: classification.ticketStatus,
                }
              : ticket,
          ),
        );
        this.capabilities.update((current) => ({
          ...current,
          [ticketId]: classification.capabilities,
        }));
        this.success.set('La solicitud fue clasificada y tiene un siguiente paso definido.');
        this.classifyingId.set(null);
      },
      error: (error) => {
        this.error.set(problemMessage(error, 'No fue posible clasificar el ticket.'));
        this.classifyingId.set(null);
      },
    });
  }

  protected diagnose(ticket: Ticket, operatingSystem: string): void {
    if (
      this.diagnosingId() ||
      !['WINDOWS', 'MACOS', 'LINUX'].includes(operatingSystem)
    ) {
      return;
    }
    this.diagnosingId.set(ticket.id);
    this.error.set(null);
    this.success.set(null);
    this.api
      .diagnose(ticket.id, {
        operatingSystem: operatingSystem as OperatingSystem,
        errorMessage: ticket.description,
      })
      .subscribe({
        next: (diagnostic) => {
          this.diagnostics.update((current) => ({
            ...current,
            [ticket.id]: diagnostic,
          }));
          this.tickets.update((tickets) =>
            tickets.map((current) =>
              current.id === ticket.id
                ? { ...current, status: diagnostic.ticketStatus }
                : current,
            ),
          );
          this.success.set('El diagnóstico terminó y ya puedes revisar el resultado.');
          this.diagnosingId.set(null);
        },
        error: (error) => {
          this.error.set(problemMessage(error, 'No fue posible ejecutar el diagnóstico.'));
          this.diagnosingId.set(null);
        },
      });
  }

  protected remediate(ticketId: string, action: string): void {
    const allowed: readonly string[] = [
      'REFRESH_VPN_PROFILE',
      'RESET_VPN_CONFIGURATION',
    ];
    if (this.remediationBusyId() || !allowed.includes(action)) {
      return;
    }
    this.remediationBusyId.set(ticketId);
    this.error.set(null);
    this.success.set(null);
    this.api
      .remediate(ticketId, {
        action: action as RemediationAction,
        requestedBy: 'diagnostic-agent',
      })
      .subscribe({
        next: (remediation) => {
          this.remediations.update((current) => ({
            ...current,
            [ticketId]: remediation,
          }));
          if (remediation.ticketStatus) {
            this.updateTicketStatus(ticketId, remediation.ticketStatus);
          }
          this.success.set(
            remediation.status === 'PENDING_APPROVAL'
              ? 'La remediación quedó pendiente de aprobación independiente.'
              : 'La remediación de bajo riesgo fue ejecutada y verificada.',
          );
          this.remediationBusyId.set(null);
          this.loadPendingRemediations();
        },
        error: (error) => {
          this.error.set(problemMessage(error, 'No fue posible proponer la remediación.'));
          this.remediationBusyId.set(null);
        },
      });
  }

  protected decide(remediation: Remediation, approved: boolean): void {
    if (this.remediationBusyId()) return;
    this.remediationBusyId.set(remediation.id);
    this.error.set(null);
    this.success.set(null);
    this.api
      .decideRemediation(remediation.id, {
        approved,
        actorId: 'approver-demo',
        reason: approved ? 'Aprobado desde la consola' : 'Rechazado desde la consola',
      })
      .subscribe({
        next: (updated) => {
          if (updated.ticketStatus) {
            this.updateTicketStatus(updated.ticketId, updated.ticketStatus);
          }
          this.remediations.update((current) => ({
            ...current,
            [updated.ticketId]: updated,
          }));
          this.pendingRemediations.update((items) =>
            items.filter((item) => item.id !== updated.id),
          );
          this.success.set(
            approved
              ? 'La aprobación fue registrada y la remediación fue procesada.'
              : 'La remediación fue rechazada de forma segura.',
          );
          this.remediationBusyId.set(null);
        },
        error: (error) => {
          this.error.set(problemMessage(error, 'No fue posible registrar la decisión.'));
          this.remediationBusyId.set(null);
        },
      });
  }

  protected resolve(ticketId: string): void {
    if (this.remediationBusyId()) return;
    this.remediationBusyId.set(ticketId);
    this.error.set(null);
    this.success.set(null);
    this.api
      .resolve(ticketId, 'Remediación ejecutada y verificada desde la consola')
      .subscribe({
        next: () => {
          this.updateTicketStatus(ticketId, 'RESOLVED');
          this.success.set('El ticket fue marcado como resuelto después de la verificación.');
          this.remediationBusyId.set(null);
        },
        error: (error) => {
          this.error.set(problemMessage(error, 'No fue posible resolver el ticket.'));
          this.remediationBusyId.set(null);
        },
      });
  }

  protected loadTimeline(ticketId: string): void {
    this.api.timeline(ticketId).subscribe({
      next: (events) =>
        this.timelines.update((current) => ({
          ...current,
          [ticketId]: events,
        })),
      error: (error) =>
        this.error.set(problemMessage(error, 'No fue posible cargar la línea de tiempo.')),
    });
  }

  protected close(ticketId: string): void {
    this.changeLifecycle(ticketId, 'close');
  }

  protected reopen(ticketId: string): void {
    this.changeLifecycle(ticketId, 'reopen');
  }

  private changeLifecycle(ticketId: string, action: 'close' | 'reopen'): void {
    if (this.lifecycleBusyId()) return;
    this.lifecycleBusyId.set(ticketId);
    this.error.set(null);
    this.success.set(null);
    const input = {
      actorId: 'support-demo',
      reason:
        action === 'close'
          ? 'Solución confirmada desde la consola'
          : 'El problema persiste según el usuario',
    };
    const request: Observable<{
      ticketId: string;
      status: Ticket['status'];
    }> =
      action === 'close'
        ? this.api.close(ticketId, input)
        : this.api.reopen(ticketId, input);
    request.subscribe({
      next: (result) => {
        this.updateTicketStatus(ticketId, result.status);
        this.success.set(
          action === 'close'
            ? 'El ticket fue cerrado correctamente.'
            : 'El ticket fue reabierto para continuar la atención.',
        );
        this.lifecycleBusyId.set(null);
        this.loadTimeline(ticketId);
      },
      error: (error) => {
        this.error.set(problemMessage(error, `No fue posible ${action === 'close' ? 'cerrar' : 'reabrir'} el ticket.`));
        this.lifecycleBusyId.set(null);
      },
    });
  }

  private loadPendingRemediations(): void {
    this.api.pendingRemediations().subscribe({
      next: (items) => this.pendingRemediations.set(items),
      error: (error) =>
        this.error.set(problemMessage(error, 'No fue posible cargar las aprobaciones.')),
    });
  }

  private updateTicketStatus(ticketId: string, status: Ticket['status']): void {
    this.tickets.update((tickets) =>
      tickets.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status } : ticket,
      ),
    );
  }

  private loadCapabilities(ticketId: string): void {
    this.api.capabilities(ticketId).subscribe({
      next: (capabilities) =>
        this.capabilities.update((current) => ({
          ...current,
          [ticketId]: capabilities,
        })),
      error: () => undefined,
    });
  }

  protected readonly statusMessage = statusMessage;
  protected readonly diagnosticMessage = diagnosticMessage;
  protected readonly recommendationMessage = recommendationMessage;
  protected readonly remediationMessage = remediationMessage;
  protected readonly remediationActionMessage = remediationActionMessage;
  protected readonly categoryMessage = categoryMessage;
  protected readonly guidanceMessage = guidanceMessage;
}
