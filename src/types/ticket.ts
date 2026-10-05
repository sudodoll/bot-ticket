export const TicketStatus = {
  Open: 'open',
  Waiting: 'waiting',
  Closed: 'closed',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const CloseReason = {
  /** Cerrado con el botón o /ticket-cerrar por el cliente o el agente. */
  ClosedByUser: 'closed_by_user',
  /** El cliente abandonó el servidor. */
  CustomerLeft: 'customer_left',
  /** Alguien eliminó el canal manualmente. */
  ChannelDeleted: 'channel_deleted',
  /** Discord devolvió un error al crear el canal o enviar el mensaje inicial. */
  CreationFailed: 'creation_failed',
  /** El bot se detuvo en medio de la creación del canal. */
  CreationInterrupted: 'creation_interrupted',
} as const;

export type CloseReason = (typeof CloseReason)[keyof typeof CloseReason];

export interface Ticket {
  readonly id: number;
  readonly ticketNumber: number;
  readonly guildId: string;
  readonly channelId: string | null;
  readonly customerId: string;
  readonly moderatorId: string | null;
  readonly status: TicketStatus;
  readonly createdAt: string;
  readonly assignedAt: string | null;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
  readonly closeReason: CloseReason | null;
}

/** Carga de trabajo de un agente, calculada desde la base de datos. */
export interface ModeratorWorkload {
  readonly moderatorId: string;
  readonly openTickets: number;
  readonly lastAssignedAt: string | null;
}

/** Agente que podría recibir un ticket. Menor presenceRank = mayor prioridad. */
export interface ModeratorCandidate {
  readonly id: string;
  readonly presenceRank: number;
}

export interface TicketPanel {
  readonly guildId: string;
  readonly channelId: string;
  readonly messageId: string;
  readonly updatedAt: string;
}
