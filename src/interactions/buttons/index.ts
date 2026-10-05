import type { ButtonHandler } from '../../types/button.js';
import { cancelCloseButton } from './cancelClose.js';
import { closeTicketButton } from './closeTicket.js';
import { confirmCloseButton } from './confirmClose.js';
import { openTicketButton } from './openTicket.js';

export const buttonHandlers: readonly ButtonHandler[] = [
  openTicketButton,
  closeTicketButton,
  confirmCloseButton,
  cancelCloseButton,
];
