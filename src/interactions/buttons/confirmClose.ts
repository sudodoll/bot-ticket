import { CustomIds } from '../../config/constants.js';
import { Messages } from '../../config/messages.js';
import type { ButtonHandler } from '../../types/button.js';
import { replyEphemeral } from '../../utils/interactionReply.js';

export const confirmCloseButton: ButtonHandler = {
  customId: CustomIds.ConfirmClose,
  async execute(interaction, ctx) {
    // deferUpdate: las respuestas siguientes reemplazan el mensaje de confirmación.
    await interaction.deferUpdate();

    // Se valida de nuevo: la confirmación pudo quedar abierta mientras el ticket cambiaba.
    const check = ctx.tickets.checkCloseRequest(interaction.channelId, interaction.user.id);
    if (!check.allowed) {
      await replyEphemeral(interaction, check.reason);
      return;
    }

    const result = await ctx.tickets.closeByUser(interaction.guild, check.ticket, interaction.user);
    await replyEphemeral(interaction, result.kind === 'closed' ? Messages.closing : Messages.ticketAlreadyClosed);
  },
};
