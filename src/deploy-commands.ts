import { DiscordAPIError, REST, RESTJSONErrorCodes, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { ConfigError, loadDeployConfig } from './config/env.js';
import { ConsoleHelp } from './config/messages.js';
import { isDiscordApiError } from './utils/discordErrors.js';
import { logger } from './utils/logger.js';

/**
 * Registra los slash commands en el servidor configurado (GUILD_ID).
 * Los comandos de servidor se actualizan al instante. Ejecutalo cada vez que cambies un comando.
 */
async function main(): Promise<void> {
  const config = loadDeployConfig();
  const body = commands.map((command) => command.data.toJSON());

  logger.info('DEPLOY', `Registrando ${body.length} comandos en el servidor ${config.guildId}...`);
  const rest = new REST().setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });

  logger.info('DEPLOY', `✅ Comandos registrados: ${body.map((command) => `/${command.name}`).join(', ')}`);
}

function explainDeployError(error: unknown): string {
  if (error instanceof ConfigError) return `${error.message}\n  Revisá el archivo .env.`;
  if (error instanceof DiscordAPIError && error.status === 401) return ConsoleHelp.invalidToken;
  if (isDiscordApiError(error, RESTJSONErrorCodes.MissingAccess)) {
    return 'Discord respondió "Missing Access": verificá que el bot esté en el servidor GUILD_ID y que lo hayas invitado con el scope "applications.commands".';
  }
  if (isDiscordApiError(error, RESTJSONErrorCodes.InvalidFormBodyOrContentType)) {
    return 'Discord rechazó la definición de los comandos o el CLIENT_ID no es válido.';
  }
  return 'No se pudieron registrar los comandos.';
}

main().catch((error: unknown) => {
  logger.error('DEPLOY', explainDeployError(error), error instanceof ConfigError ? undefined : error);
  process.exitCode = 1;
});
