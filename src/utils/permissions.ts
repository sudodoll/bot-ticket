import type { GuildBasedChannel, GuildMember, PermissionOverwriteOptions, PermissionsString } from 'discord.js';

const PERMISSION_LABELS: Partial<Record<PermissionsString, string>> = {
  ViewChannel: 'Ver canales',
  ManageChannels: 'Gestionar canales',
  ManageRoles: 'Gestionar roles / permisos',
  SendMessages: 'Enviar mensajes',
  EmbedLinks: 'Insertar enlaces',
  AttachFiles: 'Adjuntar archivos',
  ReadMessageHistory: 'Leer el historial de mensajes',
  ManageMessages: 'Gestionar mensajes',
  Administrator: 'Administrador',
};

export function formatPermissionList(permissions: readonly PermissionsString[]): string {
  return permissions.map((permission) => PERMISSION_LABELS[permission] ?? permission).join(', ');
}

/** Permisos de la lista que el miembro NO tiene en ese canal (incluye overwrites de canal y categoría). */
export function missingChannelPermissions(
  channel: GuildBasedChannel,
  member: GuildMember,
  required: readonly PermissionsString[],
): PermissionsString[] {
  return channel.permissionsFor(member).missing(required);
}

/** Convierte una lista de permisos en opciones de overwrite con todos los permisos permitidos. */
export function allowAll(permissions: readonly PermissionsString[]): PermissionOverwriteOptions {
  const options: PermissionOverwriteOptions = {};
  for (const permission of permissions) options[permission] = true;
  return options;
}
