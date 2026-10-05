import type { Client } from 'discord.js';
import type { BotContext } from '../types/context.js';
import type { EventModule } from '../types/event.js';
import { channelDeleteEvent } from './channelDelete.js';
import { clientErrorEvent, clientWarnEvent, shardDisconnectEvent, shardResumeEvent } from './clientErrors.js';
import { guildCreateEvent } from './guildCreate.js';
import { guildMemberRemoveEvent } from './guildMemberRemove.js';
import { interactionCreateEvent } from './interactionCreate.js';
import { readyEvent } from './ready.js';
import { roleDeleteEvent } from './roleDelete.js';

const events: readonly EventModule[] = [
  readyEvent,
  guildCreateEvent,
  interactionCreateEvent,
  guildMemberRemoveEvent,
  channelDeleteEvent,
  roleDeleteEvent,
  clientErrorEvent,
  clientWarnEvent,
  shardResumeEvent,
  shardDisconnectEvent,
];

export function registerEvents(client: Client, ctx: BotContext): void {
  for (const event of events) event.register(client, ctx);
}
