import type { ClientEvents } from 'discord.js';
import type { BotContext } from '../types/context.js';
import type { EventModule } from '../types/event.js';
import { logger } from '../utils/logger.js';

type EventHandler<K extends keyof ClientEvents> = (ctx: BotContext, ...args: ClientEvents[K]) => Promise<void> | void;

/**
 * Declara un evento con tipos correctos. Cualquier error (síncrono o asíncrono) del handler
 * se registra en consola en lugar de tumbar el proceso.
 */
export function defineEvent<K extends keyof ClientEvents>(
  name: K,
  handler: EventHandler<K>,
  options: { readonly once?: boolean } = {},
): EventModule {
  return {
    name,
    register(client, ctx) {
      const listener = (...args: ClientEvents[K]): void => {
        Promise.resolve()
          .then(() => handler(ctx, ...args))
          .catch((error: unknown) => logger.error('EVENT', `Error no controlado en el evento "${name}".`, error));
      };
      if (options.once) client.once(name, listener);
      else client.on(name, listener);
    },
  };
}
