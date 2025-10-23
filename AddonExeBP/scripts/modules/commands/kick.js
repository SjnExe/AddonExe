import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { playSound } from '../../core/utils.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

/**
 * Kicks a player from the server.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {import('@minecraft/server').Player} targetPlayer The player to kick.
 * @param {string} reason The reason for the kick.
 */
export function kickPlayer(player, targetPlayer, reason) {
    if (!targetPlayer) {
        sendMessage('§cPlayer not found.', player);
        if (!player.isConsole) { playSound(player, constants.soundError); }
        return;
    }

    if (player.id && player.id === targetPlayer.id) {
        sendMessage('§cYou cannot kick yourself.', player);
        playSound(player, constants.soundError);
        return;
    }

    if (!player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            playSound(player, constants.soundError);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot kick a player with the same or higher rank than you.', player);
            playSound(player, constants.soundError);
            return;
        }
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        const commandToRun = `kick "${targetPlayer.name}" ${sanitizedReason}`;
        if (player.isConsole) {
            world.getDimension('overworld').runCommand(commandToRun);
        } else {
            player.runCommand(commandToRun);
        }
        sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`, player);
        if (!player.isConsole) { playSound(player, constants.soundTeleport); }
    } catch (error) {
        sendMessage(`§cFailed to kick ${targetPlayer.name}. See console for details.`, player);
        if (!player.isConsole) { playSound(player, constants.soundError); }
        errorLog(`[/kick] Failed to run kick command for ${targetPlayer.name}:`, error);
    }
}

commandManager.register({
    name: 'kick',
    slashName: 'xkick',
    description: 'Kicks a player from the server.',
    aliases: ['boot'],
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to kick.' },
        { name: 'reason', type: 'text', description: 'The reason for kicking the player.', optional: true }
    ],
    /**
     * Executes the /kick command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {string} args.target The name of the player to kick.
     * @param {string} [args.reason] The reason for the kick.
     */
    execute: (player, args) => {
        const { target: targetName, reason = 'No reason provided' } = args;
        const targetPlayer = findPlayerByName(targetName);
        kickPlayer(player, targetPlayer, reason);
    }
});
