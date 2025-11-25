import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { getLockState, setLockState } from '../../core/playerDataManager.js';
import { updateMultipleConfig } from '../../core/configManager.js';

type DimensionLockType = 'nether' | 'end';

/**
 * Creates the execution logic for a dimension lock command.
 * @param dimension The dimension to lock ('nether' or 'end').
 * @returns The command execution function.
 */
function createLockCommandExecute(dimension: DimensionLockType) {
    return (executor: CommandExecutor, args: { isLocked?: boolean }) => {
        const currentState = getLockState(dimension);
        let newState: boolean;

        if (args.isLocked === undefined) {
            // Toggle if no argument is provided
            newState = !currentState;
        } else {
            // Set to the provided boolean value
            newState = !!args.isLocked;
        }

        setLockState(dimension, newState);

        // Also update the main config to keep the UI in sync
        const configKey = `dimensionLock.${dimension}Lock`;
        updateMultipleConfig({ [configKey]: newState });

        const dimensionName = dimension.charAt(0).toUpperCase() + dimension.slice(1);
        const status = newState ? '§cLocked' : '§aUnlocked';
        const message = `§e${dimensionName} dimension is now ${status}§e.`;

        executor.sendMessage(message);
        if (executor instanceof mc.Player) {
            playSound(executor, 'random.orb');
        }
    };
}

// --- /netherlock Command ---
const netherlockCommand: CustomCommand = {
    name: 'netherlock',
    description: 'Toggles or sets the lock for the Nether dimension.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'isLocked', type: 'boolean', optional: true }
    ],
    execute: createLockCommandExecute('nether')
};

// --- /endlock Command ---
const endlockCommand: CustomCommand = {
    name: 'endlock',
    description: 'Toggles or sets the lock for the End dimension.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'isLocked', type: 'boolean', optional: true }
    ],
    execute: createLockCommandExecute('end')
};

export default [
    netherlockCommand,
    endlockCommand
];
