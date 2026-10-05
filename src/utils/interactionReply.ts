import { MessageFlags, type RepliableInteraction } from 'discord.js';
import { isExpiredInteractionError } from './discordErrors.js';
import { logger } from './logger.js';

/**
 * Responde de forma privada (ephemeral) sin importar el estado de la interacción.
 * Si ya fue diferida (deferReply efímero o deferUpdate) edita esa respuesta.
 */
export async function replyEphemeral(interaction: RepliableInteraction, content: string): Promise<void> {
  const base = { content, embeds: [], components: [], allowedMentions: { parse: [] } };

  if (interaction.deferred) {
    await interaction.editReply(base);
  } else if (interaction.replied) {
    await interaction.followUp({ ...base, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ ...base, flags: MessageFlags.Ephemeral });
  }
}

/** Igual que replyEphemeral, pero nunca lanza: se usa para informar errores. */
export async function safeReplyEphemeral(interaction: RepliableInteraction, content: string): Promise<void> {
  try {
    await replyEphemeral(interaction, content);
  } catch (error) {
    if (!isExpiredInteractionError(error)) {
      logger.warn('DISCORD', 'No se pudo responder a la interacción.', error);
    }
  }
}
