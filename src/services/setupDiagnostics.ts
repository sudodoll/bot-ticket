import type { Guild } from 'discord.js';
import { BotRequiredPermissions } from '../config/constants.js';
import type { BotContext } from '../types/context.js';
import { formatPermissionList } from '../utils/permissions.js';

/** Revisa la configuración del servidor y devuelve los problemas encontrados (vacío = todo bien). */
export function diagnoseSetup(guild: Guild, ctx: BotContext): string[] {
  const problems: string[] = [];

  const me = guild.members.me;
  if (me) {
    const missing = me.permissions.missing(BotRequiredPermissions);
    if (missing.length > 0) problems.push(`Al bot le faltan permisos en el servidor: ${formatPermissionList(missing)}.`);
  }

  const panelChannel = ctx.panels.checkPanelChannel(guild);
  if (!panelChannel.ok) problems.push(panelChannel.reason);

  const category = ctx.channels.checkCategory(guild);
  if (!category.ok) problems.push(category.reason);

  problems.push(...ctx.supportTeam.diagnose(guild));
  return problems;
}
