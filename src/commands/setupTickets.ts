import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  channelMention,
} from 'discord.js';
import { Messages } from '../config/messages.js';
import type { PublishPanelResult } from '../services/panelService.js';
import { diagnoseSetup } from '../services/setupDiagnostics.js';
import type { SlashCommand } from '../types/command.js';
import { replyEphemeral } from '../utils/interactionReply.js';

function describePublishResult(result: PublishPanelResult): string {
  switch (result.kind) {
    case 'created':
      return `✅ Panel de tickets publicado en ${channelMention(result.channelId)}.`;
    case 'updated':
      return `✅ El panel ya existía en ${channelMention(result.channelId)}: se actualizó en lugar de publicar uno nuevo.`;
    case 'error':
      return `❌ No se pudo publicar el panel. ${result.reason}`;
  }
}

export const setupTicketsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Publica o actualiza el panel de tickets en el canal configurado.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, ctx) {
    // Doble control: los permisos por defecto del comando pueden cambiarse desde Ajustes del servidor.
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      await replyEphemeral(interaction, Messages.adminOnly);
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await ctx.panels.publish(interaction.guild);
    const problems = diagnoseSetup(interaction.guild, ctx);

    const lines = [describePublishResult(result)];
    if (problems.length > 0) {
      lines.push('', '**Revisá la configuración:**', ...problems.map((problem) => `• ${problem}`));
    }
    await replyEphemeral(interaction, lines.join('\n'));
  },
};
