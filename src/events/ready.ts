import { Events } from 'discord.js';
import { bootstrapGuild } from '../services/bootstrap.js';
import { buildInviteUrl } from '../utils/invite.js';
import { logger } from '../utils/logger.js';
import { defineEvent } from './defineEvent.js';

export const readyEvent = defineEvent(
  Events.ClientReady,
  async (ctx, client) => {
    logger.info('READY', `Bot conectado como ${client.user.tag}`);

    const guild = client.guilds.cache.get(ctx.config.guildId);
    if (!guild) {
      logger.error(
        'READY',
        `El bot no está en el servidor configurado (GUILD_ID=${ctx.config.guildId}). ` +
          `Invitalo con este enlace y el sistema se iniciará solo:\n    ${buildInviteUrl(client)}`,
      );
      return;
    }
    await bootstrapGuild(guild, ctx);
  },
  { once: true },
);
