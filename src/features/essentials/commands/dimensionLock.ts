import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { updateMultipleConfig } from '@core/config/configManager.js';
import { getLockState, setLockState } from '@core/data/playerDataManager.js';
import { playSound } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';

type Dimension = 'nether' | 'end';

interface LockCommandArgs {
  isLocked?: boolean;
}

/** Creates the execution logic for a dimension lock command. */
function createLockCommandExecute(dimension: Dimension): (executor: CommandExecutor, args: LockCommandArgs) => void {
  return (executor, args) => {
    const currentState = getLockState(dimension);
    const newState: boolean = typeof args.isLocked === 'boolean' ? args.isLocked : !currentState;

    setLockState(dimension, newState);

    const configKey = `dimensionLock.${dimension}Lock`;
    updateMultipleConfig({ [configKey]: newState });

    const dimensionName = dimension.charAt(0).toUpperCase() + dimension.slice(1);
    const status = newState ? '§cLocked' : '§aUnlocked';
    const message = `§e${dimensionName} dimension is now ${status}§e.`;

    sendMessage(message);
    if (executor instanceof mc.Player) {
      playSound(executor, 'random.orb');
    }
  };
}

const netherLockCommand: CustomCommand = {
  name: 'netherlock',
  description: 'Toggles or sets the lock for the Nether dimension.',
  category: 'Administration',
  permissionNode: 'cmd.netherlock.admin',
  allowConsole: true,
  parameters: [
    {
      name: 'isLocked',
      type: 'boolean',
      description: 'Set to true to lock, false to unlock. Toggles if omitted.',
      optional: true,
    },
  ],
  execute: createLockCommandExecute('nether'),
};

const endLockCommand: CustomCommand = {
  name: 'endlock',
  description: 'Toggles or sets the lock for the End dimension.',
  category: 'Administration',
  permissionNode: 'cmd.endlock.admin',
  allowConsole: true,
  parameters: [
    {
      name: 'isLocked',
      type: 'boolean',
      description: 'Set to true to lock, false to unlock. Toggles if omitted.',
      optional: true,
    },
  ],
  execute: createLockCommandExecute('end'),
};

export default [netherLockCommand, endLockCommand];
