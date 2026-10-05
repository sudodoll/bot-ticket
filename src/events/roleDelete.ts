import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { defineEvent } from './defineEvent.js';

export const roleDeleteEvent = defineEvent(Events.GuildRoleDelete, (ctx, role) => {
  if (role.guild.id !== ctx.config.guildId || role.id !== ctx.config.supportRoleId) return;
  logger.error(
    'CONFIG',
    'Se eliminó el rol de Atención al Cliente. Los tickets nuevos quedarán en espera hasta que crees otro rol, ' +
      'actualices CUSTOMER_SUPPORT_ROLE_ID en .env y reinicies el bot. Los agentes ya asignados conservan sus tickets.',
  );
});
