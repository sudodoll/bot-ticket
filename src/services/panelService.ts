import {
  ChannelType,
  ComponentType,
  RESTJSONErrorCodes,
  channelMention,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import type { BotConfig } from '../config/env.js';
import { BotPanelChannelPermissions, CustomIds, PANEL_SEARCH_LIMIT } from '../config/constants.js';
import type { PanelRepository } from '../database/panelRepository.js';
import { buildPanelComponents } from '../utils/components.js';
import { isDiscordApiError } from '../utils/discordErrors.js';
import { buildPanelEmbed } from '../utils/embeds.js';
import { nowIso } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import { formatPermissionList, missingChannelPermissions } from '../utils/permissions.js';

export type PanelChannelCheck =
  | { readonly ok: true; readonly channel: TextChannel }
  | { readonly ok: false; readonly reason: string };

export type PublishPanelResult =
  | { readonly kind: 'created' | 'updated'; readonly channelId: string; readonly messageUrl: string }
  | { readonly kind: 'error'; readonly reason: string };

function isPanelMessage(message: Message): boolean {
  return message.components.some(
    (row) =>
      row.type === ComponentType.ActionRow &&
      row.components.some(
        (component) => component.type === ComponentType.Button && component.customId === CustomIds.OpenTicket,
      ),
  );
}

/** Publica el panel con el botón "Abrir ticket" evitando duplicados. */
export class PanelService {
  private publishing = false;

  constructor(
    private readonly config: BotConfig,
    private readonly panels: PanelRepository,
  ) {}

  checkPanelChannel(guild: Guild): PanelChannelCheck {
    const channel = guild.channels.cache.get(this.config.ticketChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return { ok: false, reason: 'El canal del panel (TICKET_CHANNEL_ID) no existe o no es un canal de texto.' };
    }

    const me = guild.members.me;
    if (!me) return { ok: false, reason: 'El bot todavía no terminó de cargar los datos del servidor.' };

    const missing = missingChannelPermissions(channel, me, BotPanelChannelPermissions);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Al bot le faltan permisos en ${channelMention(channel.id)}: ${formatPermissionList(missing)}.`,
      };
    }
    return { ok: true, channel };
  }

  async publish(guild: Guild): Promise<PublishPanelResult> {
    if (this.publishing) {
      return { kind: 'error', reason: 'Ya se está publicando el panel. Esperá unos segundos.' };
    }
    this.publishing = true;
    try {
      return await this.publishInChannel(guild);
    } finally {
      this.publishing = false;
    }
  }

  private async publishInChannel(guild: Guild): Promise<PublishPanelResult> {
    const check = this.checkPanelChannel(guild);
    if (!check.ok) return { kind: 'error', reason: check.reason };
    const { channel } = check;

    const payload = { embeds: [buildPanelEmbed(guild)], components: buildPanelComponents() };
    const existing = await this.findExistingPanel(guild, channel);

    if (existing) {
      await existing.edit(payload);
      this.remember(guild.id, existing);
      logger.info('PANEL', `Panel de tickets actualizado en #${channel.name} (ya existía, no se duplicó).`);
      return { kind: 'updated', channelId: channel.id, messageUrl: existing.url };
    }

    await this.removePanelFromPreviousChannel(guild, channel.id);
    const message = await channel.send(payload);
    this.remember(guild.id, message);
    logger.info('PANEL', `Panel de tickets publicado en #${channel.name}.`);
    return { kind: 'created', channelId: channel.id, messageUrl: message.url };
  }

  /** Busca el panel guardado y, si no está, uno del bot entre los mensajes recientes del canal. */
  private async findExistingPanel(guild: Guild, channel: TextChannel): Promise<Message | null> {
    const stored = this.panels.find(guild.id);
    if (stored?.channelId === channel.id) {
      try {
        return await channel.messages.fetch(stored.messageId);
      } catch (error) {
        if (!isDiscordApiError(error, RESTJSONErrorCodes.UnknownMessage)) throw error;
      }
    }

    const recent = await channel.messages.fetch({ limit: PANEL_SEARCH_LIMIT });
    return recent.find((message) => message.author.id === guild.client.user.id && isPanelMessage(message)) ?? null;
  }

  /** Si TICKET_CHANNEL_ID cambió, borra el panel viejo para que no queden dos activos. */
  private async removePanelFromPreviousChannel(guild: Guild, newChannelId: string): Promise<void> {
    const stored = this.panels.find(guild.id);
    if (!stored || stored.channelId === newChannelId) return;

    const previousChannel = guild.channels.cache.get(stored.channelId);
    if (previousChannel?.type !== ChannelType.GuildText) return;
    try {
      await previousChannel.messages.delete(stored.messageId);
      logger.info('PANEL', `Se eliminó el panel anterior de #${previousChannel.name}.`);
    } catch (error) {
      if (!isDiscordApiError(error, RESTJSONErrorCodes.UnknownMessage)) {
        logger.warn('PANEL', `No se pudo eliminar el panel anterior de #${previousChannel.name}.`, error);
      }
    }
  }

  private remember(guildId: string, message: Message): void {
    this.panels.save({ guildId, channelId: message.channelId, messageId: message.id, updatedAt: nowIso() });
  }
}
