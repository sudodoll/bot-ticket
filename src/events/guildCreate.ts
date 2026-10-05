import { Events } from 'discord.js';
import { bootstrapGuild } from '../services/bootstrap.js';
import { logger } from '../utils/logger.js';
import { defineEvent } from './defineEvent.js';

/** Si el bot se conectó antes de ser invitado al servidor, el sistema arranca al entrar. */
export const guildCreateEvent = defineEvent(Events.GuildCreate, async (ctx, guild) => {
  if (guild.id !== ctx.config.guildId) {
    logger.warn('EVENT', `El bot fue agregado a "${guild.name}" (${guild.id}), que no es el servidor configurado: se ignora.`);
    return;
  }
  await bootstrapGuild(guild, ctx);
});
