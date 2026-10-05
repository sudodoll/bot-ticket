import { time, TimestampStyles, type Guild, type TimestampStylesString } from 'discord.js';
import { TICKET_CHANNEL_PREFIX, TICKET_NUMBER_DIGITS } from '../config/constants.js';

const MAX_NAME_SEGMENT_LENGTH = 32;

/** 42 → "0042" */
export function formatTicketNumber(ticketNumber: number): string {
  return ticketNumber.toString().padStart(TICKET_NUMBER_DIGITS, '0');
}

/** 42 → "#0042" */
export function ticketTag(ticketNumber: number): string {
  return `#${formatTicketNumber(ticketNumber)}`;
}

/** 42 → "ticket-0042-" (sirve para reconocer el canal de un ticket por su nombre). */
export function ticketChannelPrefix(ticketNumber: number): string {
  return `${TICKET_CHANNEL_PREFIX}-${formatTicketNumber(ticketNumber)}-`;
}

/** Convierte un nombre de usuario en un segmento válido para un canal de Discord. */
export function sanitizeChannelSegment(value: string): string {
  const sanitized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_NAME_SEGMENT_LENGTH)
    .replace(/^[-_]+|[-_]+$/g, '');
  return sanitized || 'usuario';
}

/** (42, "Valentina") → "ticket-0042-valentina" */
export function buildTicketChannelName(ticketNumber: number, username: string): string {
  return `${ticketChannelPrefix(ticketNumber)}${sanitizeChannelSegment(username)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Fecha con formato nativo de Discord: cada usuario la ve en su zona horaria. */
export function discordDate(isoDate: string, style: TimestampStylesString = TimestampStyles.LongDateTime): string {
  return time(new Date(isoDate), style);
}

export function describeUser(user: { readonly username: string; readonly id: string }): string {
  return `${user.username} (${user.id})`;
}

/** Nombre legible para logs aunque el miembro ya no esté en la caché. */
export function describeUserId(guild: Guild, userId: string): string {
  const member = guild.members.cache.get(userId);
  return member ? describeUser(member.user) : userId;
}
