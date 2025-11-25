import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getPlayer, getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import { addPunishment, removePunishment } from '../../core/punishmentManager.js';
import { parseDuration, playSoundFromConfig } from '../../core/utils.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { errorLog, warnLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

export function banPlayer(executor: CommandExecutor, targetPlayer: mc.Player, duration: string | undefined, reason: string) {
    if (executor instanceof mc.Player && executor.id === targetPlayer.id) {
        sendMessage('§cYou cannot ban yourself.', executor);
        return;
    }

    if (executor instanceof mc.Player) {
        const executorData = getPlayer(executor.id);
        const targetData = getPlayer(targetPlayer.id);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', executor);
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', executor);
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
    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`, executor);
        playSoundFromConfig(executor, 'adminNotificationReceived');
    } else {
        executor.sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`);
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        const command = `kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`;
        mc.world.getDimension('overworld').runCommand(command);
    } catch (error: any) {
        warnLog(`[Commands:Ban] Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`);
        errorLog(`[/ban] Failed to run kick command for ${targetPlayer.name}:`, error);
    }
}

const banCommand: CustomCommand = {
    name: 'ban',
    description: 'Bans a player for a specified duration with a reason.',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'duration', type: 'string', optional: true },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        const targetPlayers = args.target as mc.Player[] | undefined;
        let { duration, reason } = args as { duration?: string, reason?: string };

        if (!targetPlayers || targetPlayers.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.', executor);
            } else {
                executor.sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.');
            }
            return;
        }
        const targetPlayer = targetPlayers[0];

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        banPlayer(executor, targetPlayer, duration, reason || 'No reason provided.');
    }
};

export function unbanPlayer(executor: CommandExecutor, targetName: string) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`, executor);
        } else {
            executor.sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`);
        }
        return;
    }

    if (executor instanceof mc.Player) {
        if (executor.id === targetId) {
            sendMessage('§cYou cannot unban yourself.', executor);
            return;
        }
        const executorData = getPlayer(executor.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', executor);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot unban a player with the same or higher rank than you.', executor);
            return;
        }
    }

    removePunishment(targetId);
    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully unbanned ${targetName}. They can now rejoin the server.`, executor);
        playSoundFromConfig(executor, 'adminNotificationReceived');
    } else {
        executor.sendMessage(`§aSuccessfully unbanned ${targetName}. They can now rejoin the server.`);
    }
}

const unbanCommand: CustomCommand = {
    name: 'unban',
    aliases: ['pardon'],
    description: 'Unbans a player.',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        unbanPlayer(executor, args.target as string);
    }
};

export function offlineBanPlayer(executor: CommandExecutor, targetId: string, targetName: string, duration: string | undefined, reason: string) {
    if (executor instanceof mc.Player) {
        if (executor.id === targetId) {
            sendMessage('§cYou cannot ban yourself.', executor);
            return;
        }

        const executorData = getPlayer(executor.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', executor);
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', executor);
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
    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`, executor);
        playSoundFromConfig(executor, 'adminNotificationReceived');
    } else {
        executor.sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`);
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        mc.world.getDimension('overworld').runCommand(`kick "${targetName}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
    } catch {
        // Player is likely offline, which is fine.
    }
}

const offlineBanCommand: CustomCommand = {
    name: 'offlineban',
    aliases: ['oban'],
    description: 'Bans a player who is currently offline.',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'duration', type: 'string', optional: true },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        const { target: targetName } = args as { target: string };
        let { duration, reason } = args as { duration?: string, reason?: string };

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cPlayer "${targetName}" has never joined this server.`, executor);
            } else {
                executor.sendMessage(`§cPlayer "${targetName}" has never joined this server.`);
            }
            return;
        }

        const targetData = loadPlayerData(targetId);
        const correctTargetName = targetData ? targetData.name : targetName;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        offlineBanPlayer(executor, targetId, correctTargetName, duration, reason || 'No reason provided.');
    }
};

export default [banCommand, unbanCommand, offlineBanCommand];
