import { userMention, type Guild, type GuildMember } from 'discord.js';
import type { BotConfig } from '../config/env.js';
import type { TicketRepository } from '../database/ticketRepository.js';
import { TicketStatus, type ModeratorCandidate, type Ticket } from '../types/ticket.js';
import { buildAgentAssignedEmbed, buildAgentUnavailableEmbed } from '../utils/embeds.js';
import { describeUserId, nowIso, ticketTag } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import { pickModerator } from './moderatorSelection.js';
import type { SupportTeamService } from './supportTeamService.js';
import type { TicketChannelService } from './ticketChannelService.js';

type ActivationOutcome = 'assigned' | 'channel_missing' | 'discord_error';

export type ClaimResult =
  | { readonly kind: 'not_agent' }
  | { readonly kind: 'none_waiting' }
  | { readonly kind: 'not_found'; readonly ticketNumber: number }
  | { readonly kind: 'own_ticket'; readonly ticket: Ticket }
  | { readonly kind: 'not_waiting'; readonly ticket: Ticket }
  | { readonly kind: 'not_ready'; readonly ticket: Ticket }
  | { readonly kind: 'failed'; readonly ticket: Ticket; readonly reason: string }
  | { readonly kind: 'claimed'; readonly ticket: Ticket; readonly channelId: string };

/** Asignación de agentes: al abrir, desde la cola de espera, manualmente y al irse un agente. */
export class AssignmentService {
  private dispatchRunning = false;
  private dispatchRequested = false;

  constructor(
    private readonly config: BotConfig,
    private readonly repository: TicketRepository,
    private readonly supportTeam: SupportTeamService,
    private readonly channels: TicketChannelService,
  ) {}

  /**
   * Elige el mejor agente disponible y lo asigna en la base de datos de forma atómica.
   * No toca Discord: quien llama se encarga de darle acceso al canal.
   */
  reserveAgent(guild: Guild, ticket: Ticket): string | null {
    return this.reserveAgentFrom(this.supportTeam.getAvailableCandidates(guild), ticket);
  }

  /** Un agente toma manualmente un ticket en espera (/ticket-tomar). */
  async claim(guild: Guild, member: GuildMember, ticketNumber: number | null): Promise<ClaimResult> {
    if (!this.supportTeam.isSupportAgent(member)) return { kind: 'not_agent' };

    const ticket =
      ticketNumber === null
        ? this.repository.listWaitingWithChannel(guild.id).find((waiting) => waiting.customerId !== member.id)
        : this.repository.findByNumber(guild.id, ticketNumber);

    if (!ticket) return ticketNumber === null ? { kind: 'none_waiting' } : { kind: 'not_found', ticketNumber };
    if (ticket.customerId === member.id) return { kind: 'own_ticket', ticket };
    if (ticket.status !== TicketStatus.Waiting) return { kind: 'not_waiting', ticket };
    if (!ticket.channelId) return { kind: 'not_ready', ticket };

    // UPDATE condicionado a status = 'waiting': si otro agente lo tomó un instante antes, no hace nada.
    if (!this.repository.assignModerator(ticket.id, member.id, nowIso())) {
      return { kind: 'not_waiting', ticket: this.repository.findById(ticket.id) ?? ticket };
    }

    const outcome = await this.activateAssignment(guild, ticket, member.id, 'tomado manualmente');
    switch (outcome) {
      case 'assigned':
        return { kind: 'claimed', ticket, channelId: ticket.channelId };
      case 'channel_missing':
        return { kind: 'failed', ticket, reason: 'El canal del ticket ya no existe.' };
      case 'discord_error':
        return {
          kind: 'failed',
          ticket,
          reason: 'El bot no pudo darte acceso al canal. Verificá que tenga el permiso "Gestionar roles".',
        };
    }
  }

  /**
   * Asigna agentes a los tickets en espera (del más antiguo al más nuevo) mientras haya
   * agentes disponibles. Si ya hay una ejecución en curso, se repite al terminar. Nunca lanza.
   */
  async dispatchWaiting(guild: Guild): Promise<void> {
    if (this.dispatchRunning) {
      this.dispatchRequested = true;
      return;
    }

    this.dispatchRunning = true;
    try {
      do {
        this.dispatchRequested = false;
        await this.dispatchOnce(guild);
      } while (this.dispatchRequested);
    } catch (error) {
      logger.error('TICKET', 'Error al asignar los tickets en espera.', error);
    } finally {
      this.dispatchRunning = false;
    }
  }

  /** Devuelve a la cola los tickets de un agente que ya no está en el servidor. */
  async releaseAgentTickets(guild: Guild, moderatorId: string): Promise<number> {
    let released = 0;
    for (const ticket of this.repository.listOpenByModerator(guild.id, moderatorId)) {
      if (!this.repository.releaseModerator(ticket.id, moderatorId)) continue;
      released += 1;
      logger.info(
        'TICKET',
        `Ticket ${ticketTag(ticket.ticketNumber)} vuelve a la cola: el agente ${describeUserId(guild, moderatorId)} ya no está en el servidor.`,
      );

      const channel = this.channels.getTicketChannel(guild, ticket.channelId);
      if (!channel) continue;
      await this.channels.revokeAccess(channel, moderatorId, 'El agente asignado dejó el servidor');
      await this.channels.sendSafely(channel, { embeds: [buildAgentUnavailableEmbed(ticket)] });
    }
    return released;
  }

  async handleAgentDeparture(guild: Guild, moderatorId: string): Promise<void> {
    const released = await this.releaseAgentTickets(guild, moderatorId);
    if (released > 0) await this.dispatchWaiting(guild);
  }

  private reserveAgentFrom(candidates: readonly ModeratorCandidate[], ticket: Ticket): string | null {
    // Nadie atiende su propio ticket.
    const eligible = candidates.filter((candidate) => candidate.id !== ticket.customerId);
    if (eligible.length === 0) return null;

    return this.repository.transaction(() => {
      const workloads = this.repository.getWorkloads(ticket.guildId);
      const moderatorId = pickModerator(eligible, workloads, this.config.maxTicketsPerAgent);
      if (!moderatorId) return null;
      return this.repository.assignModerator(ticket.id, moderatorId, nowIso()) ? moderatorId : null;
    });
  }

  private async dispatchOnce(guild: Guild): Promise<void> {
    const waiting = this.repository.listWaitingWithChannel(guild.id);
    if (waiting.length === 0) return;

    const candidates = this.supportTeam.getAvailableCandidates(guild);
    if (candidates.length === 0) return;

    for (const ticket of waiting) {
      const moderatorId = this.reserveAgentFrom(candidates, ticket);
      if (!moderatorId) continue;
      const outcome = await this.activateAssignment(guild, ticket, moderatorId, 'asignado desde la cola de espera');
      // Si Discord rechaza el cambio de permisos, se reintenta en el próximo ciclo en lugar de insistir.
      if (outcome === 'discord_error') return;
    }
  }

  /** Da acceso al agente en Discord y avisa en el canal. Si falla, el ticket vuelve a la cola. */
  private async activateAssignment(
    guild: Guild,
    ticket: Ticket,
    moderatorId: string,
    origin: string,
  ): Promise<ActivationOutcome> {
    const tag = ticketTag(ticket.ticketNumber);
    const channel = this.channels.getTicketChannel(guild, ticket.channelId);
    if (!channel) {
      this.repository.releaseModerator(ticket.id, moderatorId);
      logger.warn('TICKET', `No se encontró el canal del ticket ${tag}; no se pudo asignar.`);
      return 'channel_missing';
    }

    try {
      await this.channels.grantAgentAccess(channel, ticket, moderatorId);
    } catch (error) {
      this.repository.releaseModerator(ticket.id, moderatorId);
      logger.error(
        'TICKET',
        `No se pudo dar acceso a ${describeUserId(guild, moderatorId)} al ticket ${tag}. El ticket sigue en espera.`,
        error,
      );
      return 'discord_error';
    }

    await this.channels.sendSafely(channel, {
      content: `${userMention(ticket.customerId)} ${userMention(moderatorId)}`,
      embeds: [buildAgentAssignedEmbed(ticket, moderatorId)],
      allowedMentions: { users: [ticket.customerId, moderatorId] },
    });
    logger.info('TICKET', `Ticket ${tag} asignado a ${describeUserId(guild, moderatorId)} (${origin}).`);
    return 'assigned';
  }
}
