import { commandManager } from './commandManager.js';
import { getPlayer, getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import { addPunishment, removePunishment } from '../../core/punishmentManager.js';
import { parseDuration, playSound } from '../../core/utils.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';
import { Constants } from '../../core/constants.js';

/**
 * Mutes a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {import('@minecraft/server').Player} targetPlayer The player to mute.
 * @param {string} [duration] The duration of the mute.
 * @param {string} reason The reason for the mute.
 */
export function mutePlayer(player, targetPlayer, duration, reason) {
    if (!targetPlayer) {
        sendMessage('§cPlayer not found.', player);
        playSound(player, Constants.SOUND_ERROR);
        return;
    }
    if (!player.isConsole) {
        if (player.id === targetPlayer.id) {
            sendMessage('§cYou cannot mute yourself.', player);
            playSound(player, Constants.SOUND_ERROR);
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            playSound(player, Constants.SOUND_ERROR);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot mute a player with the same or higher rank than you.', player);
            playSound(player, Constants.SOUND_ERROR);
            return;
        }
    }
    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;
    addPunishment(targetPlayer.id, {
        type: 'mute',
        expires,
        reason
    });
    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    const announcer = player.isConsole ? 'the Console' : player.name;
    sendMessage(`§aSuccessfully muted ${targetPlayer.name} ${durationText}. Reason: ${reason}`, player);
    sendMessage(`§cYou have been muted ${durationText} by ${announcer}.`, targetPlayer);
    if (!player.isConsole) {
        playSound(player, Constants.SOUND_TELEPORT);
    }
}

commandManager.register({
    name: 'mute',
    description: 'Mutes a player for a specified duration with a reason.',
    aliases: ['silence'],
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to mute.' },
        { name: 'duration', type: 'string', description: 'The duration of the mute (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the mute.', optional: true }
    ],
    /**
     * Executes the /mute command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const targetPlayer = Array.isArray(args.target) ? args.target[0] : findPlayerByName(args.target);

        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        mutePlayer(player, targetPlayer, duration, reason || 'No reason provided.');
    }
});

/**
 * Unmutes a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {string} targetName The name of the player to unmute.
 */
export function unmutePlayer(player, targetName) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        sendMessage(`§cPlayer "${targetName}" has never joined the server or name is misspelled.`, player);
        return;
    }
    if (!player.isConsole) {
        if (targetId === player.id) {
            sendMessage('§cYou cannot unmute yourself.', player);
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot unmute a player with the same or higher rank than you.', player);
            return;
        }
    }
    const success = removePunishment(targetId);

    if (!success) {
        sendMessage(`§cPlayer "${targetName}" is not currently muted.`, player);
        if (!player.isConsole) { playSound(player, Constants.SOUND_ERROR); }
        return;
    }

    sendMessage(`§aSuccessfully unmuted ${targetName}.`, player);
    if (!player.isConsole) {
        playSound(player, Constants.SOUND_TELEPORT);
    }

    const targetPlayer = findPlayerByName(targetName);
    if (targetPlayer) {
        sendMessage('§aYou have been unmuted and can now chat again.', targetPlayer);
        playSound(targetPlayer, 'random.levelup');
    }
}

commandManager.register({
    name: 'unmute',
    description: 'Unmutes a player.',
    aliases: ['um'],
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to unmute.' }
    ],
    /**
     * Executes the /unmute command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        unmutePlayer(player, args.target);
    }
});
