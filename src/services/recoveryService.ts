import type { Guild } from 'discord.js';
import type { TicketRepository } from '../database/ticketRepository.js';
import { CloseReason, TicketStatus, type Ticket } from '../types/ticket.js';
import { nowIso, ticketTag } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import type { AssignmentService } from './assignmentService.js';
import type { SupportTeamService } from './supportTeamService.js';
import type { TicketChannelService } from './ticketChannelService.js';
import type { TicketService } from './ticketService.js';

/**
 * Al iniciar, compara la base de datos con el estado real de Discord para corregir
 * lo que pasó mientras el bot estaba apagado.
 */
export class RecoveryService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly supportTeam: SupportTeamService,
    private readonly channels: TicketChannelService,
    private readonly tickets: TicketService,
    private readonly assignments: AssignmentService,
  ) {}

  async run(guild: Guild): Promise<void> {
    const active = this.repository.listActive(guild.id);
    logger.info('RECOVERY', `Revisando ${active.length} ticket(s) abierto(s) o en espera...`);

    // Evita consultar a Discord más de una vez por el mismo usuario.
    const membership = new Map<string, Promise<boolean | null>>();
    const isMember = (userId: string): Promise<boolean | null> => {
      let check = membership.get(userId);
      if (!check) {
        check = this.supportTeam.memberExists(guild, userId);
        membership.set(userId, check);
      }
      return check;
    };

    for (const ticket of active) {
      try {
        await this.reconcile(guild, ticket, isMember);
      } catch (error) {
        logger.error('RECOVERY', `No se pudo revisar el ticket ${ticketTag(ticket.ticketNumber)}.`, error);
      }
    }

    await this.deleteLeftoverChannels(guild);
    await this.assignments.dispatchWaiting(guild);
    logger.info('RECOVERY', 'Revisión de tickets completa.');
  }

  private async reconcile(
    guild: Guild,
    ticket: Ticket,
    isMember: (userId: string) => Promise<boolean | null>,
  ): Promise<void> {
    if (!ticket.channelId) {
      await this.closeInterruptedCreation(guild, ticket);
      return;
    }

    if ((await this.channels.channelExists(guild, ticket.channelId)) === false) {
      await this.tickets.closeAutomatically(
        guild,
        ticket,
        CloseReason.ChannelDeleted,
        'su canal fue eliminado mientras el bot estaba apagado.',
      );
      return;
    }

    if ((await isMember(ticket.customerId)) === false) {
      await this.tickets.closeAutomatically(guild, ticket, CloseReason.CustomerLeft, 'el cliente abandonó el servidor.');
      return;
    }

    if (ticket.status === TicketStatus.Open && ticket.moderatorId && (await isMember(ticket.moderatorId)) === false) {
      await this.assignments.releaseAgentTickets(guild, ticket.moderatorId);
    }
  }

  /** El bot se detuvo entre la reserva del número y la creación del canal. */
  private async closeInterruptedCreation(guild: Guild, ticket: Ticket): Promise<void> {
    const tag = ticketTag(ticket.ticketNumber);
    if (this.repository.close(ticket.id, guild.client.user.id, CloseReason.CreationInterrupted, nowIso())) {
      logger.warn('RECOVERY', `Ticket ${tag} cerrado: el bot se detuvo mientras se creaba su canal.`);
    }

    for (const channel of this.channels.findChannelsByTicketNumber(guild, ticket.ticketNumber)) {
      if (this.repository.findByChannelId(channel.id)) continue;
      await this.channels.deleteChannel(guild, channel.id, `Canal incompleto del ticket ${tag}`);
    }
  }

  /** Canales de tickets ya cerrados que no llegaron a borrarse (por ejemplo, por un apagado). */
  private async deleteLeftoverChannels(guild: Guild): Promise<void> {
    for (const ticket of this.repository.listClosedWithChannel(guild.id)) {
      if (!ticket.channelId || !guild.channels.cache.has(ticket.channelId)) continue;
      logger.info('RECOVERY', `Eliminando el canal pendiente del ticket cerrado ${ticketTag(ticket.ticketNumber)}.`);
      await this.channels.deleteChannel(guild, ticket.channelId, `Ticket ${ticketTag(ticket.ticketNumber)} ya cerrado`);
    }
  }
}
