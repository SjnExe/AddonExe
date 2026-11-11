import type { CommandModule } from '@core/commands/commandManager.js';

import cmdSidebar from './sidebar.js';

/** Sidebar domain slash commands. */
export const sidebarCommands: CommandModule[] = [cmdSidebar];
