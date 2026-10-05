import {
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
  type TextChannel,
  type User,
} from 'discord.js';
import type { BotConfig } from '../config/env.js';
import { Messages } from '../config/messages.js';
import type { TicketRepository } from '../database/ticketRepository.js';
import { CloseReason, TicketStatus, type Ticket } from '../types/ticket.js';
import { userFacingDiscordError } from '../utils/discordErrors.js';
import { buildTicketAutoClosedEmbed, buildTicketClosedEmbed } from '../utils/embeds.js';
import { describeUser, describeUserId, nowIso, ticketTag } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import type { AssignmentService } from './assignmentService.js';
import type { TicketChannelService } from './ticketChannelService.js';

export type OpenTicketResult =
  | { readonly kind: 'already_open'; readonly ticket: Ticket }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'failed'; readonly ticket: Ticket; readonly reason: string }
  | { readonly kind: 'created'; readonly ticket: Ticket; readonly channelId: string };

export type CloseCheck =
  | { readonly allowed: true; readonly ticket: Ticket }
  | { readonly allowed: false; readonly reason: string };

export type CloseResult = { readonly kind: 'closed'; readonly ticket: Ticket } | { readonly kind: 'already_closed' };

/** Ciclo de vida del ticket: apertura, cierre y casos especiales (salidas, canales borrados). */
export class TicketService {
  constructor(
    private readonly config: BotConfig,
    private readonly repository: TicketRepository,
    private readonly channels: TicketChannelService,
    private readonly assignments: AssignmentService,
  ) {}

  getByChannel(channelId: string): Ticket | undefined {
    return this.repository.findByChannelId(channelId);
  }

  isParticipant(ticket: Ticket, userId: string): boolean {
    return userId === ticket.customerId || userId === ticket.moderatorId;
  }

  canView(ticket: Ticket, member: GuildMember): boolean {
    return this.isParticipant(ticket, member.id) || member.permissions.has(PermissionFlagsBits.Administrator);
  }

  async openTicket(guild: Guild, customer: GuildMember): Promise<OpenTicketResult> {
    const existing = this.repository.findActiveByCustomer(guild.id, customer.id);
    if (existing) return { kind: 'already_open', ticket: existing };

    const categoryCheck = this.channels.checkCategory(guild);
    if (!categoryCheck.ok) {
      logger.error('TICKET', `No se pudo abrir un ticket para ${describeUser(customer.user)}: ${categoryCheck.reason}`);
      return { kind: 'unavailable', reason: categoryCheck.reason };
    }

    // Reserva atómica: si hubo doble clic, la segunda llamada encuentra el ticket de la primera.
    const reservation = this.repository.reserve(guild.id, customer.id, nowIso());
    if (!reservation.created) return { kind: 'already_open', ticket: reservation.existing };
    logger.info('TICKET', `Ticket ${ticketTag(reservation.ticket.ticketNumber)} creado por ${describeUser(customer.user)}`);

    this.assignments.reserveAgent(guild, reservation.ticket);
    const ticket = this.repository.findById(reservation.ticket.id) ?? reservation.ticket;
    return this.createChannelFor(guild, categoryCheck.category, ticket, customer.user);
  }

  /** Valida que quien pide cerrar sea el cliente o el agente asignado. */
  checkCloseRequest(channelId: string, userId: string): CloseCheck {
    const ticket = this.repository.findByChannelId(channelId);
    if (!ticket) return { allowed: false, reason: Messages.notATicketChannel };
    if (ticket.status === TicketStatus.Closed) return { allowed: false, reason: Messages.ticketAlreadyClosed };
    if (!this.isParticipant(ticket, userId)) return { allowed: false, reason: Messages.notAllowedToClose };
    return { allowed: true, ticket };
  }

  async closeByUser(guild: Guild, ticket: Ticket, closedBy: User): Promise<CloseResult> {
    if (!this.repository.close(ticket.id, closedBy.id, CloseReason.ClosedByUser, nowIso())) {
      return { kind: 'already_closed' };
    }
    const tag = ticketTag(ticket.ticketNumber);
    logger.info('TICKET', `Ticket ${tag} cerrado por ${describeUser(closedBy)}`);

    await this.finishClosure(
      guild,
      ticket,
      { embeds: [buildTicketClosedEmbed(ticket, closedBy.id, this.closeDelaySeconds())] },
      `Ticket ${tag} cerrado por ${closedBy.username}`,
    );
    return { kind: 'closed', ticket };
  }

  /** Cierre iniciado por el sistema. Devuelve false si el ticket ya estaba cerrado. */
  async closeAutomatically(guild: Guild, ticket: Ticket, reason: CloseReason, explanation: string): Promise<boolean> {
    // Si borraron el canal no sabemos quién fue; en el resto de los casos cierra el bot.
    const closedBy = reason === CloseReason.ChannelDeleted ? null : guild.client.user.id;
    if (!this.repository.close(ticket.id, closedBy, reason, nowIso())) return false;

    const tag = ticketTag(ticket.ticketNumber);
    logger.info('TICKET', `Ticket ${tag} cerrado automáticamente: ${explanation}`);
    await this.finishClosure(
      guild,
      ticket,
      { embeds: [buildTicketAutoClosedEmbed(ticket, explanation, this.closeDelaySeconds())] },
      `Ticket ${tag}: ${explanation}`,
    );
    return true;
  }

  /** Un miembro dejó el servidor: se cierra su ticket y se liberan los que atendía. */
  async handleMemberLeft(guild: Guild, userId: string): Promise<void> {
    const ticket = this.repository.findActiveByCustomer(guild.id, userId);
    if (ticket) {
      await this.closeAutomatically(guild, ticket, CloseReason.CustomerLeft, 'el cliente abandonó el servidor.');
    }
    await this.assignments.handleAgentDeparture(guild, userId);
  }

  async handleChannelDeleted(guild: Guild, channelId: string): Promise<void> {
    const ticket = this.repository.findByChannelId(channelId);
    if (!ticket || ticket.status === TicketStatus.Closed) return;
    await this.closeAutomatically(guild, ticket, CloseReason.ChannelDeleted, 'su canal fue eliminado manualmente.');
  }

  private async createChannelFor(
    guild: Guild,
    category: CategoryChannel,
    ticket: Ticket,
    customer: User,
  ): Promise<OpenTicketResult> {
    const tag = ticketTag(ticket.ticketNumber);

    let channel: TextChannel;
    try {
      channel = await this.channels.createTicketChannel({ guild, category, ticket, customer });
    } catch (error) {
      return this.failCreation(guild, ticket, error, null);
    }

    if (!this.repository.attachChannel(ticket.id, channel.id)) {
      // El ticket se cerró mientras se creaba el canal (por ejemplo, el cliente salió del servidor).
      await this.channels.deleteChannel(guild, channel.id, `Ticket ${tag} cancelado durante su creación`);
      return { kind: 'failed', ticket, reason: 'El ticket se canceló mientras se creaba.' };
    }

    try {
      await this.channels.sendWelcomeMessage(channel, ticket);
    } catch (error) {
      return this.failCreation(guild, ticket, error, channel.id);
    }

    if (ticket.moderatorId) {
      logger.info('TICKET', `Ticket ${tag} asignado a ${describeUserId(guild, ticket.moderatorId)}`);
    } else {
      logger.info('TICKET', `Ticket ${tag} en espera: no hay agentes disponibles.`);
    }
    return { kind: 'created', ticket, channelId: channel.id };
  }

  /**
   * Discord falló durante la creación: el ticket queda cerrado (su número no se reutiliza),
   * se borra el canal a medio crear y el usuario puede volver a intentarlo.
   */
  private async failCreation(
    guild: Guild,
    ticket: Ticket,
    error: unknown,
    channelId: string | null,
  ): Promise<OpenTicketResult> {
    const tag = ticketTag(ticket.ticketNumber);
    this.repository.close(ticket.id, guild.client.user.id, CloseReason.CreationFailed, nowIso());
    logger.error('TICKET', `Falló la creación del ticket ${tag}; quedó registrado como cerrado.`, error);
    if (channelId) await this.channels.deleteChannel(guild, channelId, `Falló la creación del ticket ${tag}`);
    // El agente que se había reservado quedó libre.
    void this.assignments.dispatchWaiting(guild);
    return { kind: 'failed', ticket, reason: userFacingDiscordError(error) };
  }

  private async finishClosure(
    guild: Guild,
    ticket: Ticket,
    notice: MessageCreateOptions,
    auditReason: string,
  ): Promise<void> {
    const channel = this.channels.getTicketChannel(guild, ticket.channelId);
    if (channel) {
      await this.channels.sendSafely(channel, notice);
      this.channels.scheduleDeletion(guild, channel.id, this.config.closeDelayMs, auditReason);
    }
    // El agente quedó libre: puede recibir un ticket que estaba en espera.
    void this.assignments.dispatchWaiting(guild);
  }

  private closeDelaySeconds(): number {
    return Math.round(this.config.closeDelayMs / 1000);
  }
}
