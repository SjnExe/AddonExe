import type { CommandModule } from '@core/commands/commandManager.js';

import cmdXraynotify from '../xray/commands/xraynotify.js';
import cmdLogs from './logs.js';
import cmdNotify from './notify.js';

/** Anti-cheat domain slash commands. */
export const anticheatCommands: CommandModule[] = [cmdLogs, cmdNotify, cmdXraynotify];
