import { InteractionContextType, MessageFlags, SlashCommandBuilder, channelMention } from 'discord.js';
import { Messages } from '../config/messages.js';
import type { ClaimResult } from '../services/assignmentService.js';
import type { SlashCommand } from '../types/command.js';
import { TicketStatus } from '../types/ticket.js';
import { ticketTag } from '../utils/format.js';
import { replyEphemeral } from '../utils/interactionReply.js';

const NUMBER_OPTION = 'numero';

function describeClaimResult(result: ClaimResult, userId: string): string {
  switch (result.kind) {
    case 'not_agent':
      return Messages.supportOnly;
    case 'none_waiting':
      return '✅ No hay tickets en espera en este momento.';
    case 'not_found':
      return `❌ No existe el ticket ${ticketTag(result.ticketNumber)}.`;
    case 'own_ticket':
      return '❌ No podés tomar tu propio ticket.';
    case 'not_ready':
      return `⏳ El ticket ${ticketTag(result.ticket.ticketNumber)} todavía se está creando. Intentá de nuevo en unos segundos.`;
    case 'failed':
      return `❌ No se pudo asignarte el ticket ${ticketTag(result.ticket.ticketNumber)}. ${result.reason}`;
    case 'claimed':
      return `✅ Tomaste el ticket ${ticketTag(result.ticket.ticketNumber)}: ${channelMention(result.channelId)}`;
    case 'not_waiting': {
      const { ticket } = result;
      const tag = ticketTag(ticket.ticketNumber);
      if (ticket.status === TicketStatus.Closed) return `🔒 El ticket ${tag} ya está cerrado.`;
      if (ticket.moderatorId === userId && ticket.channelId) {
        return `✅ Ya sos el agente asignado del ticket ${tag}: ${channelMention(ticket.channelId)}`;
      }
      return `❌ El ticket ${tag} ya está asignado a otro agente.`;
    }
  }
}

export const ticketClaimCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket-tomar')
    .setDescription('Tomá un ticket que está en espera (solo equipo de Atención al Cliente).')
    .addIntegerOption((option) =>
      option
        .setName(NUMBER_OPTION)
        .setDescription('Número del ticket. Si lo omitís, se toma el más antiguo en espera.')
        .setMinValue(1)
        .setRequired(false),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ticketNumber = interaction.options.getInteger(NUMBER_OPTION);
    const result = await ctx.assignments.claim(interaction.guild, interaction.member, ticketNumber);
    await replyEphemeral(interaction, describeClaimResult(result, interaction.user.id));
  },
};
