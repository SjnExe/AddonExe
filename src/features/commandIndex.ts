import { feature } from 'bun:bundle';

import { commandManager, type CommandModule } from '@core/commands/commandManager.js';
import { isDefined } from '@lib/guards.js';

import { anticheatCommands } from './anticheat/commands/index.js';
import { economyCommands } from './economy/commands/index.js';
import { essentialsCommands } from './essentials/commands/index.js';
import { gameplayCommands } from './gameplay/commands/index.js';
import { gamesCommands } from './games/commands/index.js';
import { moderationCommands } from './moderation/commands/index.js';
import { ranksCommands } from './ranks/commands/index.js';
import { sidebarCommands } from './sidebar/commands/index.js';
import { socialCommands } from './social/commands/index.js';
import { teleportCommands } from './teleport/commands/index.js';

/** Statically registered core command definitions aggregated across all feature domains. */
export const coreCommandModules: CommandModule[] = [
  ...anticheatCommands,
  ...economyCommands,
  ...essentialsCommands,
  ...gameplayCommands,
  ...gamesCommands,
  ...moderationCommands,
  ...ranksCommands,
  ...sidebarCommands,
  ...socialCommands,
  ...teleportCommands,
];

/**
 * Registers all core and canary slash commands into the central command manager. Core commands are loaded
 * synchronously; canary-only diagnostic commands are imported conditionally via compile-time feature flags to eliminate
 * them from release bundles.
 *
 * @returns Promise that resolves once all applicable commands have been registered.
 */
export async function loadCommands(): Promise<void> {
  for (const mod of coreCommandModules) {
    if (isDefined(mod)) {
      if (Array.isArray(mod)) {
        for (const cmd of mod) {
          commandManager.register(cmd);
        }
      } else {
        commandManager.register(mod);
      }
    }
  }

  if (feature('CANARY')) {
    const [{ default: cmdDebug }, { default: cmdTest }] = await Promise.all([
      import('./essentials/commands/debug.js'),
      import('./test/commands/test.js'),
    ]);
    if (isDefined(cmdDebug)) {
      if (Array.isArray(cmdDebug)) {
        for (const cmd of cmdDebug) {
          commandManager.register(cmd);
        }
      } else {
        commandManager.register(cmdDebug);
      }
    }
    if (isDefined(cmdTest)) {
      if (Array.isArray(cmdTest)) {
        for (const cmd of cmdTest) {
          commandManager.register(cmd);
        }
      } else {
        commandManager.register(cmdTest);
      }
    }
  }
}
