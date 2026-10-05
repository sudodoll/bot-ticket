import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Messages } from '../config/messages.js';
import type { SlashCommand } from '../types/command.js';
import { buildTicketInfoEmbed } from '../utils/embeds.js';
import { replyEphemeral } from '../utils/interactionReply.js';

export const ticketInfoCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket-info')
    .setDescription('Muestra la información del ticket de este canal.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, ctx) {
    const ticket = ctx.tickets.getByChannel(interaction.channelId);
    if (!ticket) {
      await replyEphemeral(interaction, Messages.notATicketChannel);
      return;
    }
    if (!ctx.tickets.canView(ticket, interaction.member)) {
      await replyEphemeral(interaction, Messages.notAllowedToView);
      return;
    }

    await interaction.reply({
      embeds: [buildTicketInfoEmbed(ticket)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
