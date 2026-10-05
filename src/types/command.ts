import type { ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { BotContext } from './context.js';

export interface SlashCommand {
  readonly data: {
    readonly name: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute(interaction: ChatInputCommandInteraction<'cached'>, ctx: BotContext): Promise<void>;
}
