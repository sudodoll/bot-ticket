import { CloseReason, TicketStatus, type ModeratorWorkload, type Ticket } from '../types/ticket.js';
import { isUniqueConstraintError, type SqliteDatabase } from './connection.js';

interface TicketRow {
  id: number;
  ticket_number: number;
  guild_id: string;
  channel_id: string | null;
  customer_id: string;
  moderator_id: string | null;
  status: string;
  created_at: string;
  assigned_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  close_reason: string | null;
}

interface WorkloadRow {
  moderator_id: string;
  open_tickets: number;
  last_assigned_at: string | null;
}

interface InsertTicketParams {
  ticketNumber: number;
  guildId: string;
  customerId: string;
  createdAt: string;
}

export type ReserveResult =
  | { readonly created: true; readonly ticket: Ticket }
  | { readonly created: false; readonly existing: Ticket };

const ACTIVE_CONDITION = `status IN ('${TicketStatus.Open}', '${TicketStatus.Waiting}')`;
const STATUS_VALUES: ReadonlySet<string> = new Set(Object.values(TicketStatus));
const CLOSE_REASON_VALUES: ReadonlySet<string> = new Set(Object.values(CloseReason));

function isTicketStatus(value: string): value is TicketStatus {
  return STATUS_VALUES.has(value);
}

function isCloseReason(value: string): value is CloseReason {
  return CLOSE_REASON_VALUES.has(value);
}

function toTicket(row: TicketRow): Ticket {
  if (!isTicketStatus(row.status)) {
    throw new Error(`Estado de ticket desconocido en la base de datos: "${row.status}" (ticket ${row.id}).`);
  }
  if (row.close_reason !== null && !isCloseReason(row.close_reason)) {
    throw new Error(`Motivo de cierre desconocido en la base de datos: "${row.close_reason}" (ticket ${row.id}).`);
  }
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    guildId: row.guild_id,
    channelId: row.channel_id,
    customerId: row.customer_id,
    moderatorId: row.moderator_id,
    status: row.status,
    createdAt: row.created_at,
    assignedAt: row.assigned_at,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closeReason: row.close_reason,
  };
}

function prepareStatements(db: SqliteDatabase) {
  return {
    byId: db.prepare<[number], TicketRow>('SELECT * FROM tickets WHERE id = ?'),
    byChannel: db.prepare<[string], TicketRow>('SELECT * FROM tickets WHERE channel_id = ?'),
    byNumber: db.prepare<[string, number], TicketRow>(
      'SELECT * FROM tickets WHERE guild_id = ? AND ticket_number = ?',
    ),
    activeByCustomer: db.prepare<[string, string], TicketRow>(
      `SELECT * FROM tickets WHERE guild_id = ? AND customer_id = ? AND ${ACTIVE_CONDITION}`,
    ),
    active: db.prepare<[string], TicketRow>(
      `SELECT * FROM tickets WHERE guild_id = ? AND ${ACTIVE_CONDITION} ORDER BY ticket_number`,
    ),
    openByModerator: db.prepare<[string, string], TicketRow>(
      `SELECT * FROM tickets WHERE guild_id = ? AND moderator_id = ? AND status = '${TicketStatus.Open}'
       ORDER BY ticket_number`,
    ),
    waitingWithChannel: db.prepare<[string], TicketRow>(
      `SELECT * FROM tickets WHERE guild_id = ? AND status = '${TicketStatus.Waiting}' AND channel_id IS NOT NULL
       ORDER BY ticket_number`,
    ),
    closedWithChannel: db.prepare<[string], TicketRow>(
      `SELECT * FROM tickets WHERE guild_id = ? AND status = '${TicketStatus.Closed}' AND channel_id IS NOT NULL`,
    ),
    workloads: db.prepare<[string], WorkloadRow>(
      `SELECT moderator_id,
              SUM(CASE WHEN status = '${TicketStatus.Open}' THEN 1 ELSE 0 END) AS open_tickets,
              MAX(assigned_at) AS last_assigned_at
         FROM tickets
        WHERE guild_id = ? AND moderator_id IS NOT NULL
        GROUP BY moderator_id`,
    ),
    // Nunca retrocede: aunque alguien edite la tabla a mano, sigue después del mayor número usado.
    nextTicketNumber: db.prepare<[], { value: number }>(
      `INSERT INTO counters (name, value)
            VALUES ('ticket_number', (SELECT COALESCE(MAX(ticket_number), 0) + 1 FROM tickets))
       ON CONFLICT (name) DO UPDATE
            SET value = MAX(counters.value, (SELECT COALESCE(MAX(ticket_number), 0) FROM tickets)) + 1
       RETURNING value`,
    ),
    insert: db.prepare<InsertTicketParams>(
      `INSERT INTO tickets (ticket_number, guild_id, customer_id, status, created_at)
       VALUES (@ticketNumber, @guildId, @customerId, '${TicketStatus.Waiting}', @createdAt)`,
    ),
    attachChannel: db.prepare<[string, number]>(
      `UPDATE tickets SET channel_id = ? WHERE id = ? AND channel_id IS NULL AND ${ACTIVE_CONDITION}`,
    ),
    assign: db.prepare<[string, string, number]>(
      `UPDATE tickets SET moderator_id = ?, assigned_at = ?, status = '${TicketStatus.Open}'
        WHERE id = ? AND status = '${TicketStatus.Waiting}'`,
    ),
    release: db.prepare<[number, string]>(
      `UPDATE tickets SET moderator_id = NULL, assigned_at = NULL, status = '${TicketStatus.Waiting}'
        WHERE id = ? AND status = '${TicketStatus.Open}' AND moderator_id = ?`,
    ),
    close: db.prepare<[string, string | null, CloseReason, number]>(
      `UPDATE tickets SET status = '${TicketStatus.Closed}', closed_at = ?, closed_by = ?, close_reason = ?
        WHERE id = ? AND ${ACTIVE_CONDITION}`,
    ),
  };
}

/**
 * Acceso a la tabla de tickets. Todas las operaciones son síncronas (better-sqlite3),
 * y las que modifican estado usan condiciones en el WHERE para que dos acciones
 * simultáneas (doble clic, dos agentes tomando el mismo ticket) no se pisen.
 */
export class TicketRepository {
  private readonly statements: ReturnType<typeof prepareStatements>;
  private readonly reserveTransaction: (guildId: string, customerId: string, createdAt: string) => ReserveResult;

  constructor(private readonly db: SqliteDatabase) {
    this.statements = prepareStatements(db);

    const reserve = db.transaction((guildId: string, customerId: string, createdAt: string): ReserveResult => {
      const existing = this.findActiveByCustomer(guildId, customerId);
      if (existing) return { created: false, existing };

      const counter = this.statements.nextTicketNumber.get();
      if (!counter) throw new Error('No se pudo generar el número de ticket.');

      const { lastInsertRowid } = this.statements.insert.run({
        ticketNumber: counter.value,
        guildId,
        customerId,
        createdAt,
      });
      const ticket = this.findById(Number(lastInsertRowid));
      if (!ticket) throw new Error('El ticket recién creado no se encontró en la base de datos.');
      return { created: true, ticket };
    });
    // IMMEDIATE toma el bloqueo de escritura al empezar: ningún otro proceso puede intercalarse.
    this.reserveTransaction = (guildId, customerId, createdAt) => reserve.immediate(guildId, customerId, createdAt);
  }

  /** Ejecuta varias operaciones como una sola transacción atómica. */
  transaction<T>(work: () => T): T {
    return this.db.transaction(work).immediate();
  }

  findById(id: number): Ticket | undefined {
    const row = this.statements.byId.get(id);
    return row ? toTicket(row) : undefined;
  }

  findByChannelId(channelId: string): Ticket | undefined {
    const row = this.statements.byChannel.get(channelId);
    return row ? toTicket(row) : undefined;
  }

  findByNumber(guildId: string, ticketNumber: number): Ticket | undefined {
    const row = this.statements.byNumber.get(guildId, ticketNumber);
    return row ? toTicket(row) : undefined;
  }

  findActiveByCustomer(guildId: string, customerId: string): Ticket | undefined {
    const row = this.statements.activeByCustomer.get(guildId, customerId);
    return row ? toTicket(row) : undefined;
  }

  listActive(guildId: string): Ticket[] {
    return this.statements.active.all(guildId).map(toTicket);
  }

  listOpenByModerator(guildId: string, moderatorId: string): Ticket[] {
    return this.statements.openByModerator.all(guildId, moderatorId).map(toTicket);
  }

  /** Tickets en espera que ya tienen canal, del más antiguo al más nuevo. */
  listWaitingWithChannel(guildId: string): Ticket[] {
    return this.statements.waitingWithChannel.all(guildId).map(toTicket);
  }

  listClosedWithChannel(guildId: string): Ticket[] {
    return this.statements.closedWithChannel.all(guildId).map(toTicket);
  }

  getWorkloads(guildId: string): Map<string, ModeratorWorkload> {
    const workloads = new Map<string, ModeratorWorkload>();
    for (const row of this.statements.workloads.all(guildId)) {
      workloads.set(row.moderator_id, {
        moderatorId: row.moderator_id,
        openTickets: row.open_tickets,
        lastAssignedAt: row.last_assigned_at,
      });
    }
    return workloads;
  }

  /**
   * Reserva un número de ticket y crea el registro (en espera, sin canal) de forma atómica.
   * Si el usuario ya tiene un ticket activo, lo devuelve en lugar de crear otro.
   */
  reserve(guildId: string, customerId: string, createdAt: string): ReserveResult {
    try {
      return this.reserveTransaction(guildId, customerId, createdAt);
    } catch (error) {
      // El índice único parcial rechazó un segundo ticket activo para el mismo usuario.
      if (isUniqueConstraintError(error)) {
        const existing = this.findActiveByCustomer(guildId, customerId);
        if (existing) return { created: false, existing };
      }
      throw error;
    }
  }

  /** Vincula el canal creado. Devuelve false si el ticket se cerró mientras tanto. */
  attachChannel(ticketId: number, channelId: string): boolean {
    return this.statements.attachChannel.run(channelId, ticketId).changes === 1;
  }

  /** Asigna un agente solo si el ticket sigue en espera. */
  assignModerator(ticketId: number, moderatorId: string, assignedAt: string): boolean {
    return this.statements.assign.run(moderatorId, assignedAt, ticketId).changes === 1;
  }

  /** Devuelve el ticket a la cola de espera solo si sigue asignado a ese agente. */
  releaseModerator(ticketId: number, moderatorId: string): boolean {
    return this.statements.release.run(ticketId, moderatorId).changes === 1;
  }

  /** Cierra el ticket solo si seguía activo. Devuelve false si ya estaba cerrado. */
  close(ticketId: number, closedBy: string | null, reason: CloseReason, closedAt: string): boolean {
    return this.statements.close.run(closedAt, closedBy, reason, ticketId).changes === 1;
  }
}
