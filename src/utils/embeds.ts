import { EmbedBuilder, TimestampStyles, userMention, type Guild } from 'discord.js';
import { EmbedColors } from '../config/constants.js';
import { Messages } from '../config/messages.js';
import { TicketStatus, type Ticket } from '../types/ticket.js';
import { discordDate, ticketTag } from './format.js';

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.Open]: '🟢 Abierto',
  [TicketStatus.Waiting]: '⏳ En espera',
  [TicketStatus.Closed]: '🔒 Cerrado',
};

function agentLabel(moderatorId: string | null): string {
  return moderatorId ? userMention(moderatorId) : Messages.waitingAgentLabel;
}

export function buildPanelEmbed(guild: Guild): EmbedBuilder {
  const iconURL = guild.iconURL() ?? undefined;
  return new EmbedBuilder()
    .setColor(EmbedColors.Primary)
    .setTitle('🎫 Centro de ayuda')
    .setDescription(
      [
        '¿Tenés algún problema con tu compra o necesitás ayuda?',
        '',
        'Presioná el botón de abajo para comunicarte con nuestro equipo de **Atención al Cliente**.',
      ].join('\n'),
    )
    .addFields({
      name: '¿Cómo funciona?',
      value: [
        '**1.** Presioná **Abrir ticket**.',
        '**2.** Se crea un canal privado solo para vos y el agente que te atienda.',
        '**3.** Contanos tu consulta con el mayor detalle posible.',
      ].join('\n'),
    })
    .setFooter(iconURL ? { text: `${guild.name} · Atención al Cliente`, iconURL } : { text: `${guild.name} · Atención al Cliente` });
}

export function buildWelcomeEmbed(ticket: Ticket): EmbedBuilder {
  const lines = [
    `Hola ${userMention(ticket.customerId)} 👋`,
    '',
    'Tu solicitud fue recibida correctamente.',
    'Un miembro de nuestro equipo de Atención al Cliente te ayudará por este canal.',
  ];
  if (!ticket.moderatorId) lines.push('', Messages.waitingForAgent);
  lines.push('', 'Mientras tanto, contanos en qué podemos ayudarte con el mayor detalle posible.');

  return new EmbedBuilder()
    .setColor(ticket.moderatorId ? EmbedColors.Primary : EmbedColors.Warning)
    .setTitle(`🎫 Ticket ${ticketTag(ticket.ticketNumber)}`)
    .setDescription(lines.join('\n'))
    .addFields(
      { name: '👤 Cliente', value: userMention(ticket.customerId), inline: true },
      { name: '🛠️ Agente asignado', value: agentLabel(ticket.moderatorId), inline: true },
      { name: '🎫 Ticket', value: ticketTag(ticket.ticketNumber), inline: true },
      { name: 'Fecha', value: discordDate(ticket.createdAt), inline: false },
    )
    .setFooter({ text: 'Cuando tu consulta esté resuelta, usá el botón 🔒 Cerrar ticket.' });
}

export function buildAgentAssignedEmbed(ticket: Ticket, moderatorId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.Success)
    .setTitle(`🛠️ Agente asignado · Ticket ${ticketTag(ticket.ticketNumber)}`)
    .setDescription(
      `${userMention(moderatorId)} va a atender tu consulta a partir de ahora, ${userMention(ticket.customerId)}.`,
    );
}

export function buildAgentUnavailableEmbed(ticket: Ticket): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.Warning)
    .setTitle(`⏳ Ticket ${ticketTag(ticket.ticketNumber)} en espera`)
    .setDescription(
      [
        'El agente asignado ya no está disponible en el servidor.',
        'Tu ticket volvió a la cola y otro miembro del equipo lo tomará en cuanto sea posible.',
      ].join('\n'),
    );
}

export function buildTicketClosedEmbed(ticket: Ticket, closedById: string, deleteInSeconds: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.Danger)
    .setDescription(`🔒 El ticket ${ticketTag(ticket.ticketNumber)} fue cerrado por ${userMention(closedById)}.`)
    .setFooter({ text: `Este canal se eliminará en ${deleteInSeconds} segundos.` });
}

export function buildTicketAutoClosedEmbed(ticket: Ticket, reason: string, deleteInSeconds: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.Danger)
    .setDescription(`🔒 El ticket ${ticketTag(ticket.ticketNumber)} se cerró automáticamente: ${reason}`)
    .setFooter({ text: `Este canal se eliminará en ${deleteInSeconds} segundos.` });
}

export function buildTicketInfoEmbed(ticket: Ticket): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.Primary)
    .setTitle(`🎫 Información del ticket ${ticketTag(ticket.ticketNumber)}`)
    .addFields(
      { name: 'Número', value: ticketTag(ticket.ticketNumber), inline: true },
      { name: 'Estado', value: STATUS_LABELS[ticket.status], inline: true },
      { name: '​', value: '​', inline: true },
      { name: '👤 Cliente', value: userMention(ticket.customerId), inline: true },
      { name: '🛠️ Agente', value: agentLabel(ticket.moderatorId), inline: true },
      { name: '​', value: '​', inline: true },
      {
        name: 'Fecha de creación',
        value: `${discordDate(ticket.createdAt)} (${discordDate(ticket.createdAt, TimestampStyles.RelativeTime)})`,
      },
    );
  if (ticket.assignedAt) {
    embed.addFields({ name: 'Asignado', value: discordDate(ticket.assignedAt) });
  }
  return embed;
}
