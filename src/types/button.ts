import type { ButtonInteraction } from 'discord.js';
import type { CustomId } from '../config/constants.js';
import type { BotContext } from './context.js';

export interface ButtonHandler {
  readonly customId: CustomId;
  execute(interaction: ButtonInteraction<'cached'>, ctx: BotContext): Promise<void>;
}
