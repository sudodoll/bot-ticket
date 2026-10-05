import { Events } from 'discord.js';
import { handleInteraction } from '../interactions/index.js';
import { defineEvent } from './defineEvent.js';

export const interactionCreateEvent = defineEvent(Events.InteractionCreate, (ctx, interaction) =>
  handleInteraction(interaction, ctx),
);
