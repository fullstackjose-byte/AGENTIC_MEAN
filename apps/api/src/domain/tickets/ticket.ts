import type { TicketPriority } from './priority-policy.js';
import type { TicketStatus } from './ticket-state-machine.js';
import { assertTicketTransition } from './ticket-state-machine.js';

export interface CreateTicketProps {
  id: string;
  number: string;
  subject: string;
  description: string;
  requesterId: string;
  createdAt: Date;
  containsRedactedData: boolean;
}

export class Ticket {
  readonly status: TicketStatus;
  readonly priority: TicketPriority;

  private constructor(
    readonly id: string,
    readonly number: string,
    readonly subject: string,
    readonly description: string,
    readonly requesterId: string,
    readonly createdAt: Date,
    readonly containsRedactedData: boolean,
    status: TicketStatus,
    priority: TicketPriority,
  ) {
    this.status = status;
    this.priority = priority;
  }

  static create(props: CreateTicketProps): Ticket {
    return new Ticket(
      props.id,
      props.number,
      props.subject,
      props.description,
      props.requesterId,
      props.createdAt,
      props.containsRedactedData,
      'NEW',
      'P4',
    );
  }

  static restore(
    props: CreateTicketProps & {
      status: TicketStatus;
      priority: TicketPriority;
    },
  ): Ticket {
    return new Ticket(
      props.id,
      props.number,
      props.subject,
      props.description,
      props.requesterId,
      props.createdAt,
      props.containsRedactedData,
      props.status,
      props.priority,
    );
  }

  applyTriage(priority: TicketPriority, escalate: boolean): Ticket {
    assertTicketTransition(this.status, 'CLASSIFIED');
    let status: TicketStatus = 'CLASSIFIED';
    if (escalate) {
      assertTicketTransition('CLASSIFIED', 'ESCALATED');
      status = 'ESCALATED';
    }
    return Ticket.restore({
      id: this.id,
      number: this.number,
      subject: this.subject,
      description: this.description,
      requesterId: this.requesterId,
      createdAt: this.createdAt,
      containsRedactedData: this.containsRedactedData,
      status,
      priority,
    });
  }

  startDiagnosis(escalate: boolean): Ticket {
    assertTicketTransition(this.status, 'IN_DIAGNOSIS');
    let status: TicketStatus = 'IN_DIAGNOSIS';
    if (escalate) {
      assertTicketTransition('IN_DIAGNOSIS', 'ESCALATED');
      status = 'ESCALATED';
    }
    return Ticket.restore({
      id: this.id,
      number: this.number,
      subject: this.subject,
      description: this.description,
      requesterId: this.requesterId,
      createdAt: this.createdAt,
      containsRedactedData: this.containsRedactedData,
      status,
      priority: this.priority,
    });
  }

  proposeRemediation(requiresApproval: boolean): Ticket {
    const status: TicketStatus = requiresApproval
      ? 'PENDING_APPROVAL'
      : 'IN_REMEDIATION';
    assertTicketTransition(this.status, status);
    return this.withStatus(status);
  }

  decideRemediation(approved: boolean): Ticket {
    const status: TicketStatus = approved ? 'IN_REMEDIATION' : 'ESCALATED';
    assertTicketTransition(this.status, status);
    return this.withStatus(status);
  }

  resolve(): Ticket {
    assertTicketTransition(this.status, 'RESOLVED');
    return this.withStatus('RESOLVED');
  }

  close(): Ticket {
    assertTicketTransition(this.status, 'CLOSED');
    return this.withStatus('CLOSED');
  }

  reopen(): Ticket {
    assertTicketTransition(this.status, 'REOPENED');
    return this.withStatus('REOPENED');
  }

  private withStatus(status: TicketStatus): Ticket {
    return Ticket.restore({
      id: this.id,
      number: this.number,
      subject: this.subject,
      description: this.description,
      requesterId: this.requesterId,
      createdAt: this.createdAt,
      containsRedactedData: this.containsRedactedData,
      status,
      priority: this.priority,
    });
  }
}
