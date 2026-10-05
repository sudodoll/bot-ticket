import type { Guild } from 'discord.js';
import type { BotContext } from '../types/context.js';
import { buildInviteUrl } from '../utils/invite.js';
import { logger } from '../utils/logger.js';
import { diagnoseSetup } from './setupDiagnostics.js';

const bootstrappedGuilds = new Set<string>();

/**
 * Prepara el servidor configurado: sincroniza miembros, informa problemas de configuración,
 * recupera los tickets que quedaron abiertos y arranca las tareas periódicas.
 * Se ejecuta una sola vez (al conectarse o cuando el bot es invitado al servidor).
 */
export async function bootstrapGuild(guild: Guild, ctx: BotContext): Promise<void> {
  if (bootstrappedGuilds.has(guild.id)) return;
  bootstrappedGuilds.add(guild.id);

  logger.info('READY', `Servidor: ${guild.name}. Prioridad por presencia: ${ctx.config.enablePresenceIntent ? 'activada' : 'desactivada'}.`);
  await ctx.supportTeam.refreshMembers(guild, true);

  const problems = diagnoseSetup(guild, ctx);
  for (const problem of problems) logger.warn('CONFIG', problem);
  if (problems.length > 0) {
    logger.warn('CONFIG', `Enlace de invitación con los permisos correctos: ${buildInviteUrl(guild.client)}`);
  }

  try {
    await ctx.recovery.run(guild);
  } catch (error) {
    logger.error('RECOVERY', 'La revisión de tickets al iniciar falló; el bot sigue funcionando.', error);
  }
  // Las tareas periódicas arrancan siempre: también reintentan asignar la cola de espera.
  ctx.jobs.start(guild.client);
  logger.info('READY', '✅ Sistema de tickets listo.');
}
