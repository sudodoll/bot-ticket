import type { BotConfig } from '../config/env.js';
import type { AssignmentService } from '../services/assignmentService.js';
import type { BackgroundJobs } from '../services/backgroundJobs.js';
import type { PanelService } from '../services/panelService.js';
import type { RecoveryService } from '../services/recoveryService.js';
import type { SupportTeamService } from '../services/supportTeamService.js';
import type { TicketChannelService } from '../services/ticketChannelService.js';
import type { TicketService } from '../services/ticketService.js';

/** Dependencias compartidas que reciben eventos, comandos y botones. */
export interface BotContext {
  readonly config: BotConfig;
  readonly tickets: TicketService;
  readonly assignments: AssignmentService;
  readonly supportTeam: SupportTeamService;
  readonly channels: TicketChannelService;
  readonly panels: PanelService;
  readonly recovery: RecoveryService;
  readonly jobs: BackgroundJobs;
  /** Apaga el bot de forma ordenada (canales pendientes, conexión a Discord y SQLite). */
  readonly shutdown: (exitCode: number) => Promise<void>;
}
