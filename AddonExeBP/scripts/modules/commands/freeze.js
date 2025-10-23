import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

/**
 * Freezes a player by disabling their input permissions.
 * @param {import('@minecraft/server').Player | object} executor
 * @param {import('@minecraft/server').Player} targetPlayer
 */
export function freezePlayer(executor, targetPlayer) {
    if (targetPlayer.hasTag(constants.frozenTag)) {
        sendMessage(`§ePlayer ${targetPlayer.name} is already frozen.`, executor);
        return;
    }
    try {
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" camera disabled`);
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" movement disabled`);
        targetPlayer.addTag(constants.frozenTag);

        const announcer = executor.isConsole ? 'the Console' : executor.name;
        sendMessage(`§aSuccessfully froze ${targetPlayer.name}.`, executor);
        sendMessage(`§cYou have been frozen by ${announcer}.`, targetPlayer);
    } catch (error) {
        sendMessage(`§cFailed to freeze ${targetPlayer.name}.`, executor);
        errorLog(`[Freeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error}`);
    }
}

/**
 * Unfreezes a player by enabling their input permissions.
 * @param {import('@minecraft/server').Player | object} executor
 * @param {import('@minecraft/server').Player} targetPlayer
 */
export function unfreezePlayer(executor, targetPlayer) {
    if (!targetPlayer.hasTag(constants.frozenTag)) {
        sendMessage(`§ePlayer ${targetPlayer.name} is not frozen.`, executor);
        return;
    }
    try {
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" camera enabled`);
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" movement enabled`);
        targetPlayer.removeTag(constants.frozenTag);

        sendMessage(`§aSuccessfully unfroze ${targetPlayer.name}.`, executor);
        sendMessage('§aYou have been unfrozen.', targetPlayer);
    } catch (error) {
        sendMessage(`§cFailed to unfreeze ${targetPlayer.name}.`, executor);
        errorLog(`[Unfreeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error}`);
    }
}

commandManager.register({
    name: 'freeze',
    description: 'Freezes a player, preventing them from moving or looking around.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to freeze.' }
    ],
    /**
     * Executes the /freeze command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }
        if (!player.isConsole && player.id === targetPlayer.id) {
            sendMessage('§cYou cannot freeze yourself.', player);
            return;
        }
        freezePlayer(player, targetPlayer);
    }
});

commandManager.register({
    name: 'unfreeze',
    description: 'Unfreezes a player, allowing them to move and look around again.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to unfreeze.' }
    ],
    /**
     * Executes the /unfreeze command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }
        unfreezePlayer(player, targetPlayer);
    }
});
