import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

export function isDiscordApiError(error: unknown, ...codes: readonly number[]): error is DiscordAPIError {
  if (!(error instanceof DiscordAPIError)) return false;
  if (codes.length === 0) return true;
  return typeof error.code === 'number' && codes.includes(error.code);
}

/** La interacción expiró (más de 3 s sin responder) o ya fue respondida. */
export function isExpiredInteractionError(error: unknown): boolean {
  return isDiscordApiError(
    error,
    RESTJSONErrorCodes.UnknownInteraction,
    RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged,
  );
}

export function isMissingPermissionsError(error: unknown): boolean {
  return isDiscordApiError(error, RESTJSONErrorCodes.MissingPermissions, RESTJSONErrorCodes.MissingAccess);
}

/** Traduce un error de Discord a un mensaje entendible para el usuario. */
export function userFacingDiscordError(error: unknown): string {
  if (isMissingPermissionsError(error)) {
    return 'El bot no tiene los permisos necesarios en el servidor o en la categoría de tickets.';
  }
  if (isDiscordApiError(error, RESTJSONErrorCodes.MaximumNumberOfGuildChannelsReached)) {
    return 'El servidor alcanzó el límite de canales permitido por Discord.';
  }
  if (isDiscordApiError(error, RESTJSONErrorCodes.UnknownChannel)) {
    return 'El canal o la categoría configurados ya no existen.';
  }
  if (isDiscordApiError(error, RESTJSONErrorCodes.InvalidFormBodyOrContentType)) {
    return 'Discord rechazó la creación del canal (por ejemplo, la categoría llegó al máximo de 50 canales).';
  }
  return 'Discord devolvió un error inesperado.';
}
