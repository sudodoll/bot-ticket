import { MessageFlags, channelMention, userMention } from 'discord.js';
import { CustomIds } from '../../config/constants.js';
import { Messages } from '../../config/messages.js';
import type { OpenTicketResult } from '../../services/ticketService.js';
import type { ButtonHandler } from '../../types/button.js';
import { ticketTag } from '../../utils/format.js';
import { replyEphemeral } from '../../utils/interactionReply.js';

function describeOpenResult(result: OpenTicketResult): string {
  switch (result.kind) {
    case 'created': {
      const created = `✅ Tu ticket fue creado: ${channelMention(result.channelId)}`;
      return result.ticket.moderatorId
        ? `${created}\n🛠️ Agente asignado: ${userMention(result.ticket.moderatorId)}`
        : `${created}\n${Messages.waitingForAgent}`;
    }
    case 'already_open':
      return result.ticket.channelId
        ? `❌ Ya tenés un ticket abierto: ${channelMention(result.ticket.channelId)}`
        : `❌ Ya tenés un ticket abierto (${ticketTag(result.ticket.ticketNumber)}). Esperá unos segundos mientras se termina de crear.`;
    case 'unavailable':
      return '❌ No es posible abrir tickets en este momento por un problema de configuración del servidor. Avisá a un administrador.';
    case 'failed':
      return `❌ No se pudo crear tu ticket. ${result.reason} Intentá de nuevo en unos minutos; si el problema continúa, avisá a un administrador.`;
  }
}

export const openTicketButton: ButtonHandler = {
  customId: CustomIds.OpenTicket,
  async execute(interaction, ctx) {
    // Se difiere enseguida: crear el canal puede tardar más que los 3 s que da Discord.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await ctx.tickets.openTicket(interaction.guild, interaction.member);
    await replyEphemeral(interaction, describeOpenResult(result));
  },
};
