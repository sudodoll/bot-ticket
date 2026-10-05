import { Events } from 'discord.js';
import { defineEvent } from './defineEvent.js';

/** Un cliente o un agente abandonó el servidor (o fue expulsado). */
export const guildMemberRemoveEvent = defineEvent(Events.GuildMemberRemove, async (ctx, member) => {
  if (member.guild.id !== ctx.config.guildId) return;
  await ctx.tickets.handleMemberLeft(member.guild, member.id);
});
