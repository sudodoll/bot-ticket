import type { SlashCommand } from '../types/command.js';
import { setupTicketsCommand } from './setupTickets.js';
import { ticketClaimCommand } from './ticketClaim.js';
import { ticketCloseCommand } from './ticketClose.js';
import { ticketInfoCommand } from './ticketInfo.js';

export const commands: readonly SlashCommand[] = [
  setupTicketsCommand,
  ticketInfoCommand,
  ticketClaimCommand,
  ticketCloseCommand,
];
