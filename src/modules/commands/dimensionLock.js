import { commandManager } from './commandManager.js';
import { playSound } from '../../core/utils.js';
import { getLockState, setLockState } from '../../core/playerDataManager.js';
import { updateMultipleConfig } from '../../core/configManager.js';

/**
 * Creates the execution logic for a dimension lock command.
 * @param {'nether' | 'end'} dimension
 * @returns {(player: import('@minecraft/server').Player, args: { isLocked?: boolean }) => void}
 */
function createLockCommandExecute(dimension) {
    return (player, args) => {
        let currentState = getLockState(dimension);
        let newState;

        if (args.isLocked === undefined) {
            // Toggle if no argument is provided
            newState = !currentState;
        } else {
            // Set to the provided boolean value
            newState = args.isLocked;
        }

        setLockState(dimension, newState);

        // Also update the main config to keep the UI in sync
        const configKey = `dimensionLock.${dimension}Lock`;
        updateMultipleConfig({ [configKey]: newState });

        const dimensionName = dimension.charAt(0).toUpperCase() + dimension.slice(1);
        const status = newState ? '§cLocked' : '§aUnlocked';
        const message = `§e${dimensionName} dimension is now ${status}§e.`;

        player.sendMessage(message);
        if (!player.isConsole) {
            playSound(player, 'random.orb');
        }
    };
}

// --- /netherlock Command ---
commandManager.register({
    name: 'netherlock',
    description: 'Toggles or sets the lock for the Nether dimension.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'isLocked', type: 'boolean', description: 'Set to true to lock, false to unlock. Toggles if omitted.', optional: true }
    ],
    execute: createLockCommandExecute('nether')
});

// --- /endlock Command ---
commandManager.register({
    name: 'endlock',
    description: 'Toggles or sets the lock for the End dimension.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'isLocked', type: 'boolean', description: 'Set to true to lock, false to unlock. Toggles if omitted.', optional: true }
    ],
    execute: createLockCommandExecute('end')
});
