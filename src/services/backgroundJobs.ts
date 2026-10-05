import type { Client, Guild } from 'discord.js';
import type { BotConfig } from '../config/env.js';
import { Timings } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import type { AssignmentService } from './assignmentService.js';
import type { SupportTeamService } from './supportTeamService.js';

/** Tareas periódicas: asignar tickets en espera y refrescar la lista de agentes. */
export class BackgroundJobs {
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly config: BotConfig,
    private readonly supportTeam: SupportTeamService,
    private readonly assignments: AssignmentService,
  ) {}

  get running(): boolean {
    return this.timers.length > 0;
  }

  start(client: Client<true>): void {
    if (this.running) return;
    this.timers = [
      setInterval(this.forGuild(client, (guild) => this.assignments.dispatchWaiting(guild)), Timings.WaitingDispatchIntervalMs),
      setInterval(this.forGuild(client, (guild) => this.supportTeam.refreshMembers(guild)), Timings.MemberRefreshIntervalMs),
    ];
    logger.info('READY', 'Tareas periódicas iniciadas (cola de espera cada 60 s).');
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }

  private forGuild(client: Client<true>, job: (guild: Guild) => Promise<unknown>): () => void {
    return () => {
      const guild = client.guilds.cache.get(this.config.guildId);
      if (!guild) return;
      job(guild).catch((error: unknown) => logger.error('PROCESS', 'Error en una tarea periódica.', error));
    };
  }
}
