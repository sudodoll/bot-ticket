import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  userMention,
  type CategoryChannel,
  type Guild,
  type MessageCreateOptions,
  type OverwriteResolvable,
  type TextChannel,
  type User,
} from 'discord.js';
import type { BotConfig } from '../config/env.js';
import {
  AgentPermissions,
  BotRequiredPermissions,
  BotTicketChannelPermissions,
  CustomerPermissions,
} from '../config/constants.js';
import type { Ticket } from '../types/ticket.js';
import { buildTicketControls } from '../utils/components.js';
import { isDiscordApiError } from '../utils/discordErrors.js';
import { buildWelcomeEmbed } from '../utils/embeds.js';
import { buildTicketChannelName, ticketChannelPrefix, ticketTag } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import { allowAll, formatPermissionList, missingChannelPermissions } from '../utils/permissions.js';

export type CategoryCheck =
  | { readonly ok: true; readonly category: CategoryChannel }
  | { readonly ok: false; readonly reason: string };

interface PendingDeletion {
  readonly timer: NodeJS.Timeout;
  readonly guild: Guild;
  readonly reason: string;
}

interface CreateTicketChannelParams {
  readonly guild: Guild;
  readonly category: CategoryChannel;
  readonly ticket: Ticket;
  readonly customer: User;
}

/** Todo lo que toca canales de Discord: creación privada, permisos, mensajes y borrado. */
export class TicketChannelService {
  private readonly pendingDeletions = new Map<string, PendingDeletion>();

  constructor(private readonly config: BotConfig) {}

  /** Verifica que la categoría exista y que el bot tenga allí los permisos necesarios. */
  checkCategory(guild: Guild): CategoryCheck {
    const category = guild.channels.cache.get(this.config.ticketsCategoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return { ok: false, reason: 'La categoría de tickets (TICKETS_CATEGORY_ID) no existe o no es una categoría.' };
    }

    const me = guild.members.me;
    if (!me) return { ok: false, reason: 'El bot todavía no terminó de cargar los datos del servidor.' };

    const missing = missingChannelPermissions(category, me, BotRequiredPermissions);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Al bot le faltan permisos en la categoría ${category.name}: ${formatPermissionList(missing)}.`,
      };
    }
    return { ok: true, category };
  }

  getTicketChannel(guild: Guild, channelId: string | null): TextChannel | null {
    if (!channelId) return null;
    const channel = guild.channels.cache.get(channelId);
    return channel?.type === ChannelType.GuildText ? channel : null;
  }

  /** true = existe · false = Discord confirma que no existe · null = no se pudo verificar. */
  async channelExists(guild: Guild, channelId: string): Promise<boolean | null> {
    if (guild.channels.cache.has(channelId)) return true;
    try {
      await guild.channels.fetch(channelId, { force: true });
      return true;
    } catch (error) {
      if (isDiscordApiError(error, RESTJSONErrorCodes.UnknownChannel)) return false;
      logger.warn('DISCORD', `No se pudo verificar si el canal ${channelId} existe.`, error);
      return null;
    }
  }

  /** Canales de texto cuyo nombre corresponde a ese número de ticket (ticket-0042-...). */
  findChannelsByTicketNumber(guild: Guild, ticketNumber: number): TextChannel[] {
    const prefix = ticketChannelPrefix(ticketNumber);
    return [...guild.channels.cache.values()].filter(
      (channel): channel is TextChannel => channel.type === ChannelType.GuildText && channel.name.startsWith(prefix),
    );
  }

  /**
   * Crea el canal privado del ticket. Solo lo ven el cliente, el agente asignado (si hay)
   * y el bot. Los administradores lo ven porque Discord no permite ocultarles canales.
   */
  async createTicketChannel({ guild, category, ticket, customer }: CreateTicketChannelParams): Promise<TextChannel> {
    const tag = ticketTag(ticket.ticketNumber);
    return guild.channels.create({
      name: buildTicketChannelName(ticket.ticketNumber, customer.username),
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Ticket ${tag} · Cliente: ${customer.username} (${customer.id})`,
      permissionOverwrites: this.buildOverwrites(guild, ticket),
      reason: `Ticket ${tag} abierto por ${customer.username}`,
    });
  }

  async sendWelcomeMessage(channel: TextChannel, ticket: Ticket): Promise<void> {
    const mentioned = ticket.moderatorId ? [ticket.customerId, ticket.moderatorId] : [ticket.customerId];
    await channel.send({
      content: mentioned.map((id) => userMention(id)).join(' '),
      embeds: [buildWelcomeEmbed(ticket)],
      components: buildTicketControls(),
      allowedMentions: { users: mentioned },
    });
  }

  /** Suma al agente a un canal existente (requiere el permiso Gestionar roles). */
  async grantAgentAccess(channel: TextChannel, ticket: Ticket, moderatorId: string): Promise<void> {
    await channel.permissionOverwrites.edit(moderatorId, allowAll(AgentPermissions), {
      type: OverwriteType.Member,
      reason: `Agente asignado al ticket ${ticketTag(ticket.ticketNumber)}`,
    });
  }

  /** Quita el acceso de un usuario al canal. Nunca lanza. */
  async revokeAccess(channel: TextChannel, userId: string, reason: string): Promise<void> {
    try {
      await channel.permissionOverwrites.delete(userId, reason);
    } catch (error) {
      logger.warn('DISCORD', `No se pudo quitar el acceso de ${userId} al canal #${channel.name}.`, error);
    }
  }

  /** Envía un mensaje sin lanzar errores; devuelve si se pudo enviar. */
  async sendSafely(channel: TextChannel, options: MessageCreateOptions): Promise<boolean> {
    try {
      await channel.send(options);
      return true;
    } catch (error) {
      logger.warn('DISCORD', `No se pudo enviar un mensaje en #${channel.name}.`, error);
      return false;
    }
  }

  /** Programa el borrado del canal sin bloquear el proceso mientras espera. */
  scheduleDeletion(guild: Guild, channelId: string, delayMs: number, reason: string): void {
    if (this.pendingDeletions.has(channelId)) return;
    const timer = setTimeout(() => {
      this.pendingDeletions.delete(channelId);
      void this.deleteChannel(guild, channelId, reason);
    }, delayMs);
    this.pendingDeletions.set(channelId, { timer, guild, reason });
  }

  /** Elimina el canal si todavía existe. Nunca lanza. */
  async deleteChannel(guild: Guild, channelId: string, reason: string): Promise<void> {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;
    try {
      await channel.delete(reason);
      logger.info('TICKET', `Canal #${channel.name} eliminado.`);
    } catch (error) {
      if (isDiscordApiError(error, RESTJSONErrorCodes.UnknownChannel)) return;
      logger.error(
        'TICKET',
        `No se pudo eliminar el canal #${channel.name} (${channelId}). Revisá el permiso "Gestionar canales" del bot o eliminalo a mano.`,
        error,
      );
    }
  }

  /** Al apagar el bot: elimina enseguida los canales que estaban esperando su borrado. */
  async flushPendingDeletions(timeoutMs: number): Promise<void> {
    const pending = [...this.pendingDeletions.entries()];
    this.pendingDeletions.clear();
    if (pending.length === 0) return;

    for (const [, deletion] of pending) clearTimeout(deletion.timer);
    const deletions = Promise.allSettled(
      pending.map(([channelId, deletion]) => this.deleteChannel(deletion.guild, channelId, deletion.reason)),
    );

    let timeout: NodeJS.Timeout | undefined;
    const limit = new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([deletions, limit]);
    clearTimeout(timeout);
  }

  private buildOverwrites(guild: Guild, ticket: Ticket): OverwriteResolvable[] {
    const overwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
      { id: guild.client.user.id, type: OverwriteType.Member, allow: BotTicketChannelPermissions },
      { id: ticket.customerId, type: OverwriteType.Member, allow: CustomerPermissions },
    ];
    if (ticket.moderatorId) {
      overwrites.push({ id: ticket.moderatorId, type: OverwriteType.Member, allow: AgentPermissions });
    }
    return overwrites;
  }
}
