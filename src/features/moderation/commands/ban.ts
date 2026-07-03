// FIXED
import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { config } from '@core/../config.js';
import { errorLog, warnLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerIdByName, loadPlayerData } from '@core/playerDataManager.js';
import { canTarget } from '@core/rankManager.js';
import { parseDuration, playSoundFromConfig } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';

import { addPunishment, removePunishment } from '@features/moderation/punishmentManager.js';

export function banPlayer(executor: CommandExecutor, targetPlayer: mc.Player, duration: string | undefined, reason: string) {
    if (executor instanceof mc.Player && executor.id === targetPlayer.id) {
        sendMessage('§cYou cannot ban yourself.', executor);
        return;
    }

    if (!canTarget(executor, targetPlayer.id, config)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', executor);
        } else {
            executor.sendMessage('§cYou cannot ban a player with the same or higher rank than you.');
        }
        return;
    }

    const durationString = isDefined(duration) ? duration : 'perm';
    const durationMs = isDefined(duration) ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;
    const announcer = executor instanceof mc.Player ? executor.name : 'the Console';

    addPunishment(
        targetPlayer.id,
        targetPlayer.name,
        {
            type: 'ban',
            expires,
            reason
        },
        announcer
    );

    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`, executor);
        playSoundFromConfig(executor, 'adminNotificationReceived');
    } else {
        executor.sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`);
    }

    try {
        const sanitizedReason = reason.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
        const command = `kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`;
        mc.world.getDimension('overworld').runCommand(command);
    } catch (error: unknown) {
        warnLog(`[Commands:Ban] Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`);
        errorLog(`[/ban] Failed to run kick command for ${targetPlayer.name}:`, error);
    }
}

interface BanCommandArgs {
    target?: mc.Player[];
    duration?: string;
    reason?: string;
}

const banCommand: CustomCommand = {
    name: 'ban',
    description: 'Bans a player for a specified duration with a reason.',
    category: 'Moderation',
    permissionNode: 'cmd.ban.admin',
    allowConsole: true,
    hidden: true,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'duration', type: 'string', optional: true },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: BanCommandArgs) => {
        const targetPlayers = args.target;
        let { duration, reason } = args;

        if (!isDefined(targetPlayers) || targetPlayers.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.', executor);
            } else {
                executor.sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.');
            }
            return;
        }
        const targetPlayer = targetPlayers[0];
        if (!targetPlayer) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }

        if (isDefined(duration) && parseDuration(duration) === 0) {
            reason = `${duration}${isDefined(reason) ? ' ' + reason : ''}`;
            duration = undefined;
        }

        banPlayer(executor, targetPlayer, duration, isDefined(reason) ? reason : 'No reason provided.');
    }
};

export function unbanPlayer(executor: CommandExecutor, targetName: string) {
    const targetId = getPlayerIdByName(targetName);

    if (!isDefined(targetId)) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`, executor);
        } else {
            executor.sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`);
        }
        return;
    }

    if (executor instanceof mc.Player && executor.id === targetId) {
        sendMessage('§cYou cannot unban yourself.', executor);
        return;
    }

    if (!canTarget(executor, targetId, config)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cYou cannot unban a player with the same or higher rank than you.', executor);
        } else {
            executor.sendMessage('§cYou cannot unban a player with the same or higher rank than you.');
        }
        return;
    }

    removePunishment(targetId, 'ban');
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
    category: 'Moderation',
    permissionNode: 'cmd.unban.admin',
    allowConsole: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        unbanPlayer(executor, args.target as string);
    }
};

export function offlineBanPlayer(executor: CommandExecutor, targetId: string, targetName: string, duration: string | undefined, reason: string) {
    if (executor instanceof mc.Player && executor.id === targetId) {
        sendMessage('§cYou cannot ban yourself.', executor);
        return;
    }

    if (!canTarget(executor, targetId, config)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', executor);
        } else {
            executor.sendMessage('§cYou cannot ban a player with the same or higher rank than you.');
        }
        return;
    }

    const durationString = isDefined(duration) ? duration : 'perm';
    const durationMs = isDefined(duration) ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;
    const announcer = executor instanceof mc.Player ? executor.name : 'the Console';

    addPunishment(
        targetId,
        targetName,
        {
            type: 'ban',
            expires,
            reason
        },
        announcer
    );

    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`, executor);
        playSoundFromConfig(executor, 'adminNotificationReceived');
    } else {
        executor.sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`);
    }

    try {
        const sanitizedReason = reason.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
        mc.world.getDimension('overworld').runCommand(`kick "${targetName}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
    } catch {
        // Player is likely offline, which is fine.
    }
}

interface OfflineBanCommandArgs {
    target: string;
    duration?: string;
    reason?: string;
}

const offlineBanCommand: CustomCommand = {
    name: 'offlineban',
    aliases: ['oban'],
    description: 'Bans a player who is currently offline.',
    category: 'Moderation',
    permissionNode: 'cmd.offlineban.admin',
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'duration', type: 'string', optional: true },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const argsTyped = args as unknown as OfflineBanCommandArgs;
        const targetName = argsTyped.target;
        let { duration, reason } = argsTyped;

        const targetId = getPlayerIdByName(targetName);
        if (!isDefined(targetId)) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cPlayer "${targetName}" has never joined this server.`, executor);
            } else {
                executor.sendMessage(`§cPlayer "${targetName}" has never joined this server.`);
            }
            return;
        }

        const targetData = loadPlayerData(targetId);
        const correctTargetName = isDefined(targetData) ? targetData.name : targetName;

        if (isDefined(duration) && parseDuration(duration) === 0) {
            reason = `${duration}${isDefined(reason) ? ' ' + reason : ''}`;
            duration = undefined;
        }

        offlineBanPlayer(executor, targetId, correctTargetName, duration, isDefined(reason) ? reason : 'No reason provided.');
    }
};

export default [banCommand, unbanCommand, offlineBanCommand];
