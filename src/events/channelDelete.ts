import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { defineEvent } from './defineEvent.js';

export const channelDeleteEvent = defineEvent(Events.ChannelDelete, async (ctx, channel) => {
  if (channel.isDMBased() || channel.guildId !== ctx.config.guildId) return;

  if (channel.id === ctx.config.ticketsCategoryId) {
    logger.error(
      'CONFIG',
      'Se eliminó la categoría de tickets. No se podrán abrir tickets nuevos hasta que crees otra, ' +
        'actualices TICKETS_CATEGORY_ID en .env y reinicies el bot. Los tickets abiertos siguen funcionando.',
    );
    return;
  }

  if (channel.id === ctx.config.ticketChannelId) {
    logger.error(
      'CONFIG',
      'Se eliminó el canal del panel de tickets. Creá uno nuevo, actualizá TICKET_CHANNEL_ID en .env, ' +
        'reiniciá el bot y ejecutá /setup-tickets.',
    );
    return;
  }

  await ctx.tickets.handleChannelDeleted(channel.guild, channel.id);
});
