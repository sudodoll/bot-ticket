import { CustomIds } from '../../config/constants.js';
import type { ButtonHandler } from '../../types/button.js';
import { requestTicketClose } from '../closeFlow.js';

export const closeTicketButton: ButtonHandler = {
  customId: CustomIds.CloseTicket,
  execute: requestTicketClose,
};
