import type { CommandModule } from '@core/commands/commandManager.js';

import cmdGameplay from './gameplay.js';

/** Gameplay mechanics domain slash commands. */
export const gameplayCommands: CommandModule[] = [cmdGameplay];
