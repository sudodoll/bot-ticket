import { Client, GatewayIntentBits, Partials } from 'discord.js';
import type { BotConfig } from './config/env.js';

/**
 * Intents:
 *  - Guilds: servidor, canales, roles e interacciones (y los eventos de canal/rol borrado).
 *  - GuildMembers (privilegiado): saber quién tiene el rol de soporte y detectar salidas del servidor.
 *  - GuildPresences (privilegiado, opcional): priorizar agentes conectados.
 * No se necesitan GuildMessages ni MessageContent: el bot no lee mensajes.
 */
export function createBotClient(config: BotConfig): Client {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers];
  if (config.enablePresenceIntent) intents.push(GatewayIntentBits.GuildPresences);

  return new Client({
    intents,
    // Permite recibir guildMemberRemove aunque el miembro no estuviera en caché.
    partials: [Partials.GuildMember],
    // Por defecto no se menciona a nadie; cada mensaje habilita explícitamente a quién avisar.
    allowedMentions: { parse: [] },
  });
}
