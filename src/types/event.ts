import type { Client } from 'discord.js';
import type { BotContext } from './context.js';

/** Un evento de Discord listo para registrarse en el cliente. */
export interface EventModule {
  readonly name: string;
  register(client: Client, ctx: BotContext): void;
}
