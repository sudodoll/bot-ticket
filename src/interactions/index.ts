import type { ButtonInteraction, ChatInputCommandInteraction, Interaction, RepliableInteraction } from 'discord.js';
import { commands } from '../commands/index.js';
import { Messages } from '../config/messages.js';
import type { ButtonHandler } from '../types/button.js';
import type { BotContext } from '../types/context.js';
import { isExpiredInteractionError } from '../utils/discordErrors.js';
import { describeUser } from '../utils/format.js';
import { safeReplyEphemeral } from '../utils/interactionReply.js';
import { logger } from '../utils/logger.js';
import { buttonHandlers } from './buttons/index.js';

const commandsByName = new Map(commands.map((command) => [command.data.name, command]));
const buttonsById = new Map<string, ButtonHandler>(buttonHandlers.map((handler) => [handler.customId, handler]));

/**
 * Punto de entrada de todas las interacciones. Los botones se resuelven por customId,
 * así siguen funcionando aunque el bot se haya reiniciado.
 */
export async function handleInteraction(interaction: Interaction, ctx: BotContext): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (!interaction.inCachedGuild() || interaction.guildId !== ctx.config.guildId) {
      await safeReplyEphemeral(interaction, Messages.wrongGuild);
      return;
    }
    await runCommand(interaction, ctx);
    return;
  }

  if (interaction.isButton()) {
    if (!interaction.inCachedGuild() || interaction.guildId !== ctx.config.guildId) {
      await safeReplyEphemeral(interaction, Messages.wrongGuild);
      return;
    }
    await runButton(interaction, ctx);
  }
}

async function runCommand(interaction: ChatInputCommandInteraction<'cached'>, ctx: BotContext): Promise<void> {
  const command = commandsByName.get(interaction.commandName);
  if (!command) {
    await safeReplyEphemeral(interaction, Messages.unknownAction);
    return;
  }
  logger.info('COMMAND', `/${interaction.commandName} usado por ${describeUser(interaction.user)}`);
  await runSafely(interaction, `/${interaction.commandName}`, () => command.execute(interaction, ctx));
}

async function runButton(interaction: ButtonInteraction<'cached'>, ctx: BotContext): Promise<void> {
  const handler = buttonsById.get(interaction.customId);
  if (!handler) {
    logger.warn('BUTTON', `Botón desconocido "${interaction.customId}" presionado por ${describeUser(interaction.user)}.`);
    await safeReplyEphemeral(interaction, Messages.unknownAction);
    return;
  }
  await runSafely(interaction, `botón ${interaction.customId}`, () => handler.execute(interaction, ctx));
}

/** Ningún error de una interacción puede tumbar el proceso: se registra y se avisa al usuario. */
async function runSafely(interaction: RepliableInteraction, label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (isExpiredInteractionError(error)) {
      logger.warn('DISCORD', `La interacción (${label}) expiró antes de que el bot pudiera responder.`);
      return;
    }
    logger.error('EVENT', `Error al procesar ${label} de ${describeUser(interaction.user)}.`, error);
    await safeReplyEphemeral(interaction, Messages.unexpectedError);
  }
}
