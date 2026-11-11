import type { CommandModule } from '@core/commands/commandManager.js';

import cmdListranks from './listranks.js';
import cmdRank from './rank.js';

/** Ranks domain slash commands. */
export const ranksCommands: CommandModule[] = [cmdListranks, cmdRank];
