import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { Messages } from '../config/messages.js';
import type { BotContext } from '../types/context.js';
import { buildCloseConfirmation } from '../utils/components.js';
import { replyEphemeral } from '../utils/interactionReply.js';

/**
 * Primer paso del cierre (botón 🔒 o /ticket-cerrar): valida permisos y pide confirmación.
 * La confirmación es privada, así que solo la ve quien la pidió.
 */
export async function requestTicketClose(
  interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
  ctx: BotContext,
): Promise<void> {
  const check = ctx.tickets.checkCloseRequest(interaction.channelId, interaction.user.id);
  if (!check.allowed) {
    await replyEphemeral(interaction, check.reason);
    return;
  }

  await interaction.reply({
    content: Messages.closeConfirmation,
    components: buildCloseConfirmation(),
    flags: MessageFlags.Ephemeral,
  });
}
