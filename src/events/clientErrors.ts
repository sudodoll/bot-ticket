import { Events, GatewayCloseCodes } from 'discord.js';
import { ConsoleHelp } from '../config/messages.js';
import { logger } from '../utils/logger.js';
import { defineEvent } from './defineEvent.js';

/** Sin un listener de "error", un error del cliente cerraría el proceso. */
export const clientErrorEvent = defineEvent(Events.Error, (_ctx, error) => {
  logger.error('DISCORD', 'Error del cliente de Discord.', error);
});

export const clientWarnEvent = defineEvent(Events.Warn, (_ctx, message) => {
  logger.warn('DISCORD', message);
});

export const shardResumeEvent = defineEvent(Events.ShardResume, () => {
  logger.info('DISCORD', 'Conexión con Discord restablecida.');
});

/** Desconexiones sin recuperación posible: se explica la causa y se apaga el bot. */
export const shardDisconnectEvent = defineEvent(Events.ShardDisconnect, async (ctx, closeEvent) => {
  switch (closeEvent.code) {
    case GatewayCloseCodes.AuthenticationFailed:
      logger.error('DISCORD', ConsoleHelp.invalidToken);
      break;
    case GatewayCloseCodes.DisallowedIntents:
      logger.error('DISCORD', ConsoleHelp.disallowedIntents);
      break;
    default:
      logger.error('DISCORD', `Discord cerró la conexión de forma definitiva (código ${closeEvent.code}).`);
  }
  await ctx.shutdown(1);
});
