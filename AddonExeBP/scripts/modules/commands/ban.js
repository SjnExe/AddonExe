import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getPlayer, getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import { addPunishment, removePunishment } from '../../core/punishmentManager.js';
import { parseDuration, playSoundFromConfig } from '../../core/utils.js';
import { findPlayerByName } from '../utils/playerUtils.js';
import { errorLog } from '../../core/errorLogger.js';

export function banPlayer(player, targetPlayer, duration, reason) {
    // Console execution does not have a player object with an id
    if (player && player.id === targetPlayer.id) {
        player.sendMessage('§cYou cannot ban yourself.');
        return;
    }

    // Permission check for player execution
    if (player && !player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);

        if (!executorData || !targetData) {
            player.sendMessage('§cCould not retrieve player data for permission check.');
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            player.sendMessage('§cYou cannot ban a player with the same or higher rank than you.');
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
    player.sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`);

    if (player && !player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
        try {
            // Player can run kick command
            player.runCommand(`kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${reason}`);
        } catch (error) {
            player.sendMessage(`§eWarning: Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`);
            errorLog(`[/x:ban] Failed to run kick command for ${targetPlayer.name} after banning:`, error);
        }
    } else {
        // For console, run the command in the overworld.
        try {
            const command = `kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${reason}`;
            world.getDimension('overworld').runCommand(command);
        } catch (error) {
            // This outer catch is for unexpected errors.
            console.warn(`[Commands:Ban] Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`); // eslint-disable-line no-console
            errorLog(`[/x:ban] Failed to run kick command from console for ${targetPlayer.name}:`, error);
        }
    }
}

commandManager.register({
    name: 'ban',
    description: 'Bans a player for a specified duration with a reason.',
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to ban.' },
        { name: 'duration', type: 'string', description: 'The duration of the ban (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the ban.', optional: true }
    ],
    execute: (player, args) => {
        // For slash commands (from player or console), target is a player object array.
        // For chat commands, it's a name string.
        const targetPlayer = Array.isArray(args.target) ? args.target[0] : findPlayerByName(args.target);

        if (!targetPlayer) {
            player.sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.');
            return;
        }

        // Prevent console from banning itself (it has no ID)
        if (player.isConsole && !targetPlayer.id) {
            player.sendMessage('§cCannot target the console for a ban.');
            return;
        }

        let duration = args.duration;
        let reason = args.reason;

        // The command manager can't distinguish between an optional duration and the reason.
        // We need to check if the 'duration' argument is actually a duration or the start of the reason.
        if (duration && parseDuration(duration) === 0) {
            // It's not a valid duration, so it must be the start of the reason.
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined; // Reset duration
        }

        banPlayer(player, targetPlayer, duration, reason || 'No reason provided.');
    }
});

export function unbanPlayer(player, targetName) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        player.sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`);
        return;
    }

    // --- Permission Checks ---
    if (!player.isConsole) {
        if (player.id === targetId) {
            player.sendMessage('§cYou cannot unban yourself.');
            return;
        }
        const executorData = getPlayer(player.id);
        // Load the offline player's data for the check
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            player.sendMessage('§cCould not retrieve player data for permission check.');
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            player.sendMessage('§cYou cannot unban a player with the same or higher rank than you.');
            return;
        }
    }

    removePunishment(targetId);
    player.sendMessage(`§aSuccessfully unbanned ${targetName}. They can now rejoin the server.`);
    if (!player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
    }
}

commandManager.register({
    name: 'unban',
    aliases: ['pardon'],
    description: 'Unbans a player.',
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to unban.' }
    ],
    execute: (player, args) => {
        unbanPlayer(player, args.target);
    }
});

export function offlineBanPlayer(player, targetId, targetName, duration, reason) {
    if (!player.isConsole) {
        if (player.id === targetId) {
            player.sendMessage('§cYou cannot ban yourself.');
            return;
        }

        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            player.sendMessage('§cCould not retrieve player data for permission check.');
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            player.sendMessage('§cYou cannot ban a player with the same or higher rank than you.');
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
    player.sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`);
    if (!player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
    }

    try {
        player.runCommand(`kick "${targetName}" You have been banned ${durationText}. Reason: ${reason}`);
    } catch {
        // Player is likely offline, which is fine.
    }
}

commandManager.register({
    name: 'offlineban',
    aliases: ['oban'],
    description: 'Bans a player who is currently offline.',
    category: 'Moderation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to ban.' },
        { name: 'duration', type: 'string', description: 'The duration of the ban (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the ban.', optional: true }
    ],
    execute: (player, args) => {
        const { target: targetName } = args;

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) {
            player.sendMessage(`§cPlayer "${targetName}" has never joined this server.`);
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
