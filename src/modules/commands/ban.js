import * as mc from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getPlayer, getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import { addPunishment, removePunishment } from '../../core/punishmentManager.js';
import { parseDuration, playSoundFromConfig } from '../../core/utils.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { errorLog, warnLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

/**
 * Bans a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {import('@minecraft/server').Player} targetPlayer The player to ban.
 * @param {string} [duration] The duration of the ban.
 * @param {string} reason The reason for the ban.
 */
export function banPlayer(player, targetPlayer, duration, reason) {
    if (player && player.id === targetPlayer.id) {
        sendMessage('§cYou cannot ban yourself.', player);
        return;
    }

    if (player && !player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', player);
            return;
        }
    }

    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;

    addPunishment(targetPlayer.id, {
        type: 'ban',
        expires,
        reason
    });

    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`, player);

    if (player && !player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
        try {
            const sanitizedReason = reason.replace(/"/g, '\\"');
            player.runCommand(`kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
        } catch (error) {
            sendMessage(`§eWarning: Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`, player);
            errorLog(`[/ban] Failed to run kick command for ${targetPlayer.name} after banning:`, error);
        }
    } else {
        try {
            const sanitizedReason = reason.replace(/"/g, '\\"');
            const command = `kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`;
            mc.world.getDimension('overworld').runCommand(command);
        } catch (error) {
            warnLog(`[Commands:Ban] Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`);
            errorLog(`[/ban] Failed to run kick command from console for ${targetPlayer.name}:`, error);
        }
    }
}

commandManager.register({
    name: 'ban',
    description: 'Bans a player for a specified duration with a reason.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to ban.' },
        { name: 'duration', type: 'string', description: 'The duration of the ban (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the ban.', optional: true }
    ],
    /**
     * Executes the /ban command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const targetPlayer = Array.isArray(args.target) ? args.target[0] : findPlayerByName(args.target);

        if (!targetPlayer) {
            sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.', player);
            return;
        }

        if (player.isConsole && !targetPlayer.id) {
            sendMessage('§cCannot target the console for a ban.', player);
            return;
        }

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        banPlayer(player, targetPlayer, duration, reason || 'No reason provided.');
    }
});

/**
 * Unbans a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {string} targetName The name of the player to unban.
 */
export function unbanPlayer(player, targetName) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`, player);
        return;
    }

    if (!player.isConsole) {
        if (player.id === targetId) {
            sendMessage('§cYou cannot unban yourself.', player);
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot unban a player with the same or higher rank than you.', player);
            return;
        }
    }

    removePunishment(targetId);
    sendMessage(`§aSuccessfully unbanned ${targetName}. They can now rejoin the server.`, player);
    if (!player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
    }
}

commandManager.register({
    name: 'unban',
    aliases: ['pardon'],
    description: 'Unbans a player.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to unban.' }
    ],
    /**
     * Executes the /unban command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        unbanPlayer(player, args.target);
    }
});

/**
 * Bans an offline player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {string} targetId The ID of the player to ban.
 * @param {string} targetName The name of the player to ban.
 * @param {string} [duration] The duration of the ban.
 * @param {string} reason The reason for the ban.
 */
export function offlineBanPlayer(player, targetId, targetName, duration, reason) {
    if (!player.isConsole) {
        if (player.id === targetId) {
            sendMessage('§cYou cannot ban yourself.', player);
            return;
        }

        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', player);
            return;
        }
    }

    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;

    addPunishment(targetId, {
        type: 'ban',
        expires,
        reason
    });

    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`, player);
    if (!player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        player.runCommand(`kick "${targetName}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
    } catch {
        // Player is likely offline, which is fine.
    }
}

commandManager.register({
    name: 'offlineban',
    aliases: ['oban'],
    description: 'Bans a player who is currently offline.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to ban.' },
        { name: 'duration', type: 'string', description: 'The duration of the ban (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the ban.', optional: true }
    ],
    /**
     * Executes the /offlineban command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const { target: targetName } = args;

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) {
            sendMessage(`§cPlayer "${targetName}" has never joined this server.`, player);
            return;
        }

        const targetData = loadPlayerData(targetId);
        const correctTargetName = targetData ? targetData.name : targetName;

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        offlineBanPlayer(player, targetId, correctTargetName, duration, reason || 'No reason provided.');
    }
});
