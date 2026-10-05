import type { PermissionsString } from 'discord.js';

/** customId de todos los botones. Se procesan siempre desde el evento global interactionCreate. */
export const CustomIds = {
  OpenTicket: 'ticket:open',
  CloseTicket: 'ticket:close',
  ConfirmClose: 'ticket:close:confirm',
  CancelClose: 'ticket:close:cancel',
} as const;

export type CustomId = (typeof CustomIds)[keyof typeof CustomIds];

export const EmbedColors = {
  Primary: 0x5865f2,
  Success: 0x57f287,
  Warning: 0xfee75c,
  Danger: 0xed4245,
} as const;

export const Timings = {
  /** Cada cuánto se intenta asignar agente a los tickets en espera. */
  WaitingDispatchIntervalMs: 60_000,
  /** Cada cuánto se vuelve a descargar la lista completa de miembros (respaldo de la caché). */
  MemberRefreshIntervalMs: 15 * 60_000,
  /** Tiempo mínimo entre dos descargas completas de miembros (Discord limita este pedido). */
  MemberRefreshMinGapMs: 5 * 60_000,
  MemberFetchTimeoutMs: 30_000,
  /** Tiempo máximo para eliminar canales pendientes al apagar el bot. */
  ShutdownFlushTimeoutMs: 5_000,
} as const;

export const TICKET_NUMBER_DIGITS = 4;
export const TICKET_CHANNEL_PREFIX = 'ticket';
/** Mensajes recientes que se revisan en el canal del panel para no duplicarlo. */
export const PANEL_SEARCH_LIMIT = 50;

/** Permisos del cliente dentro de su ticket. */
export const CustomerPermissions = [
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'AttachFiles',
  'EmbedLinks',
] as const satisfies readonly PermissionsString[];

/** Permisos del agente asignado dentro del ticket. */
export const AgentPermissions = [...CustomerPermissions, 'ManageMessages'] as const satisfies readonly PermissionsString[];

/** Permisos explícitos del bot dentro de cada canal de ticket. */
export const BotTicketChannelPermissions = [
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'EmbedLinks',
  'AttachFiles',
  'ManageChannels',
] as const satisfies readonly PermissionsString[];

/**
 * Permisos que necesita el bot en el servidor (y en la categoría de tickets).
 * Discord solo deja otorgar en un canal permisos que el bot ya tiene, por eso incluye
 * AttachFiles y ManageMessages. ManageRoles permite editar los permisos de un canal ya
 * creado (sumar al agente cuando un ticket en espera es asignado).
 */
export const BotRequiredPermissions = [
  'ViewChannel',
  'ManageChannels',
  'ManageRoles',
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'ManageMessages',
] as const satisfies readonly PermissionsString[];

/** Permisos del bot en el canal del panel. */
export const BotPanelChannelPermissions = [
  'ViewChannel',
  'SendMessages',
  'EmbedLinks',
  'ReadMessageHistory',
] as const satisfies readonly PermissionsString[];
