import { OAuth2Scopes, type Client } from 'discord.js';
import { BotRequiredPermissions } from '../config/constants.js';

/** Enlace para invitar al bot con exactamente los permisos que necesita. */
export function buildInviteUrl(client: Client<true>): string {
  return client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: BotRequiredPermissions,
  });
}
