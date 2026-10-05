import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { requestTicketClose } from '../interactions/closeFlow.js';
import type { SlashCommand } from '../types/command.js';

/** Alternativa al botón 🔒 por si el mensaje inicial del ticket fue borrado. */
export const ticketCloseCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket-cerrar')
    .setDescription('Cierra el ticket de este canal (pide confirmación).')
    .setContexts(InteractionContextType.Guild),

  execute: requestTicketClose,
};
