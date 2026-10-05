import { CustomIds } from '../../config/constants.js';
import { Messages } from '../../config/messages.js';
import type { ButtonHandler } from '../../types/button.js';

export const cancelCloseButton: ButtonHandler = {
  customId: CustomIds.CancelClose,
  async execute(interaction) {
    await interaction.update({ content: Messages.closeCancelled, components: [] });
  },
};
