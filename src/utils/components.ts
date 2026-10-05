import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CustomIds } from '../config/constants.js';

type ButtonRow = ActionRowBuilder<ButtonBuilder>;

function row(...buttons: ButtonBuilder[]): ButtonRow {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

export function buildPanelComponents(): ButtonRow[] {
  return [
    row(
      new ButtonBuilder()
        .setCustomId(CustomIds.OpenTicket)
        .setLabel('Abrir ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildTicketControls(): ButtonRow[] {
  return [
    row(
      new ButtonBuilder()
        .setCustomId(CustomIds.CloseTicket)
        .setLabel('Cerrar ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildCloseConfirmation(): ButtonRow[] {
  return [
    row(
      new ButtonBuilder()
        .setCustomId(CustomIds.ConfirmClose)
        .setLabel('Sí, cerrar')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(CustomIds.CancelClose)
        .setLabel('Cancelar')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}
