import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/errorLogger.js';

const FROZEN_TAG = 'frozen';

/**
 * Freezes a player by disabling their input permissions.
 * @param {import('@minecraft/server').Player | { isConsole: true, sendMessage: (msg: string) => void }} executor
 * @param {import('@minecraft/server').Player} targetPlayer
 */
export function freezePlayer(executor, targetPlayer) {
    if (targetPlayer.hasTag(FROZEN_TAG)) {
        executor.sendMessage(`§ePlayer ${targetPlayer.name} is already frozen.`);
        return;
    }
    try {
        // Run commands from the dimension (server context) to ensure permissions
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" camera disabled`);
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" movement disabled`);
        targetPlayer.addTag(FROZEN_TAG);

        const announcer = executor.isConsole ? 'the Console' : executor.name;
        executor.sendMessage(`§aSuccessfully froze ${targetPlayer.name}.`);
        targetPlayer.sendMessage(`§cYou have been frozen by ${announcer}.`);
    } catch (error) {
        executor.sendMessage(`§cFailed to freeze ${targetPlayer.name}.`);
        errorLog(`[Freeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error}`);
    }
}

/**
 * Unfreezes a player by enabling their input permissions.
 * @param {import('@minecraft/server').Player | { isConsole: true, sendMessage: (msg: string) => void }} executor
 * @param {import('@minecraft/server').Player} targetPlayer
 */
export function unfreezePlayer(executor, targetPlayer) {
    if (!targetPlayer.hasTag(FROZEN_TAG)) {
        executor.sendMessage(`§ePlayer ${targetPlayer.name} is not frozen.`);
        return;
    }
    try {
        // Run commands from the dimension (server context)
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" camera enabled`);
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" movement enabled`);
        targetPlayer.removeTag(FROZEN_TAG);

        executor.sendMessage(`§aSuccessfully unfroze ${targetPlayer.name}.`);
        targetPlayer.sendMessage('§aYou have been unfrozen.');
    } catch (error) {
        executor.sendMessage(`§cFailed to unfreeze ${targetPlayer.name}.`);
        errorLog(`[Unfreeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error}`);
    }
}

commandManager.register({
    name: 'freeze',
    description: 'Freezes a player, preventing them from moving or looking around.',
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to freeze.' }
    ],
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        if (!player.isConsole && player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot freeze yourself.');
            return;
        }
        freezePlayer(player, targetPlayer);
    }
});

commandManager.register({
    name: 'unfreeze',
    description: 'Unfreezes a player, allowing them to move and look around again.',
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to unfreeze.' }
    ],
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        unfreezePlayer(player, targetPlayer);
    }
});
