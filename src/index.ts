import { DiscordjsError, DiscordjsErrorCodes, type Client } from 'discord.js';
import { createBotClient } from './client.js';
import { Timings } from './config/constants.js';
import { ConfigError, loadBotConfig, type BotConfig } from './config/env.js';
import { ConsoleHelp } from './config/messages.js';
import { closeDatabase, openDatabase, type SqliteDatabase } from './database/connection.js';
import { runMigrations } from './database/migrations.js';
import { PanelRepository } from './database/panelRepository.js';
import { TicketRepository } from './database/ticketRepository.js';
import { registerEvents } from './events/index.js';
import { AssignmentService } from './services/assignmentService.js';
import { BackgroundJobs } from './services/backgroundJobs.js';
import { PanelService } from './services/panelService.js';
import { RecoveryService } from './services/recoveryService.js';
import { SupportTeamService } from './services/supportTeamService.js';
import { TicketChannelService } from './services/ticketChannelService.js';
import { TicketService } from './services/ticketService.js';
import type { BotContext } from './types/context.js';
import { logger } from './utils/logger.js';

function loadConfigOrExit(): BotConfig {
  try {
    return loadBotConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error('CONFIG', `${error.message}\n  Revisá el archivo .env (podés partir de .env.example).`);
      process.exit(1);
    }
    throw error;
  }
}

function explainLoginError(error: unknown): string {
  if (error instanceof DiscordjsError && error.code === DiscordjsErrorCodes.TokenInvalid) return ConsoleHelp.invalidToken;
  if (error instanceof Error && /disallowed intents/i.test(error.message)) return ConsoleHelp.disallowedIntents;
  return 'No se pudo conectar con Discord. Revisá tu conexión a internet y el token.';
}

interface ShutdownDeps {
  readonly client: Client;
  readonly db: SqliteDatabase;
  readonly jobs: BackgroundJobs;
  readonly channels: TicketChannelService;
}

function createShutdown({ client, db, jobs, channels }: ShutdownDeps): (exitCode: number) => Promise<void> {
  let shuttingDown = false;

  return async (exitCode) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('SHUTDOWN', 'Deteniendo el bot...');

    jobs.stop();
    try {
      await channels.flushPendingDeletions(Timings.ShutdownFlushTimeoutMs);
    } catch (error) {
      logger.warn('SHUTDOWN', 'No se pudieron eliminar algunos canales pendientes (se reintentará al iniciar).', error);
    }
    try {
      await client.destroy();
    } catch (error) {
      logger.warn('SHUTDOWN', 'Error al cerrar la conexión con Discord.', error);
    }
    closeDatabase(db);

    logger.info('SHUTDOWN', 'Bot detenido correctamente.');
    process.exitCode = exitCode;
    // Si algo externo mantiene vivo el proceso, se fuerza la salida.
    setTimeout(() => process.exit(exitCode), 2_000).unref();
  };
}

function registerProcessHandlers(shutdown: (exitCode: number) => Promise<void>): void {
  process.once('SIGINT', () => void shutdown(0));
  process.once('SIGTERM', () => void shutdown(0));

  process.on('unhandledRejection', (reason) => {
    logger.error('PROCESS', 'Promesa rechazada sin manejar (el bot sigue funcionando).', reason);
  });
  process.on('uncaughtException', (error) => {
    logger.error('PROCESS', 'Error inesperado: el bot se cerrará de forma ordenada.', error);
    void shutdown(1);
  });
}

async function main(): Promise<void> {
  const config = loadConfigOrExit();

  const db = openDatabase(config.databasePath);
  runMigrations(db);

  const ticketRepository = new TicketRepository(db);
  const supportTeam = new SupportTeamService(config);
  const channels = new TicketChannelService(config);
  const assignments = new AssignmentService(config, ticketRepository, supportTeam, channels);
  const tickets = new TicketService(config, ticketRepository, channels, assignments);
  const panels = new PanelService(config, new PanelRepository(db));
  const recovery = new RecoveryService(ticketRepository, supportTeam, channels, tickets, assignments);
  const jobs = new BackgroundJobs(config, supportTeam, assignments);

  const client = createBotClient(config);
  const shutdown = createShutdown({ client, db, jobs, channels });
  const ctx: BotContext = { config, tickets, assignments, supportTeam, channels, panels, recovery, jobs, shutdown };

  registerEvents(client, ctx);
  registerProcessHandlers(shutdown);

  logger.info('READY', 'Conectando con Discord...');
  try {
    await client.login(config.token);
  } catch (error) {
    logger.error('READY', explainLoginError(error), error);
    await shutdown(1);
  }
}

main().catch((error: unknown) => {
  logger.error('PROCESS', 'No se pudo iniciar el bot.', error);
  process.exit(1);
});
