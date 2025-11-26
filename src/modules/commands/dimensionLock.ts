import * as mc from '@minecraft/server';

import { updateMultipleConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';
import { getLockState, setLockState } from '../../core/playerDataManager.js';
import { playSound } from '../../core/utils.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

type Dimension = 'nether' | 'end';

/**
 * Creates the execution logic for a dimension lock command.
 */
function createLockCommandExecute(dimension: Dimension): (executor: CommandExecutor, args: any) => void {
    return (executor, args) => {
        const currentState = getLockState(dimension);
        let newState: boolean;

        if (typeof args.isLocked === 'boolean') {
            newState = args.isLocked;
        } else {
            newState = !currentState;
        }

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
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        {
            name: 'isLocked',
            type: 'boolean',
            description: 'Set to true to lock, false to unlock. Toggles if omitted.',
            optional: true
        }
    ],
    execute: createLockCommandExecute('nether')
};

const endLockCommand: CustomCommand = {
    name: 'endlock',
    description: 'Toggles or sets the lock for the End dimension.',
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        {
            name: 'isLocked',
            type: 'boolean',
            description: 'Set to true to lock, false to unlock. Toggles if omitted.',
            optional: true
        }
    ],
    execute: createLockCommandExecute('end')
};

export default [netherLockCommand, endLockCommand];
