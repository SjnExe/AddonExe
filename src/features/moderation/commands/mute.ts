import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayer, getPlayerIdByName, loadPlayerData } from '@core/playerDataManager.js';
import { parseDuration, playSound } from '@core/utils.js';

import { addPunishment, removePunishment } from '../punishmentManager.js';

export function mutePlayer(
    executor: CommandExecutor,
    targetPlayer: mc.Player,
    duration: string | undefined,
    reason: string
) {
    if (!targetPlayer) {
        if (executor instanceof mc.Player) {
            sendMessage('§cPlayer not found.', executor);
            playSound(executor, constants.soundError);
        } else {
            executor.sendMessage('§cPlayer not found.');
        }
        return;
    }
    if (executor instanceof mc.Player) {
        if (executor.id === targetPlayer.id) {
            sendMessage('§cYou cannot mute yourself.', executor);
            playSound(executor, constants.soundError);
            return;
        }
        const executorData = getPlayer(executor.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', executor);
            playSound(executor, constants.soundError);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot mute a player with the same or higher rank than you.', executor);
            playSound(executor, constants.soundError);
            return;
        }
    }
    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;
    const announcer = executor instanceof mc.Player ? executor.name : 'the Console';
    addPunishment(
        targetPlayer.id,
        targetPlayer.name,
        {
            type: 'mute',
            expires,
            reason
        },
        announcer
    );
    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;

    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully muted ${targetPlayer.name} ${durationText}. Reason: ${reason}`, executor);
        playSound(executor, constants.soundTeleport);
    } else {
        executor.sendMessage(`§aSuccessfully muted ${targetPlayer.name} ${durationText}. Reason: ${reason}`);
    }
    sendMessage(`§cYou have been muted ${durationText} by ${announcer}.`, targetPlayer);
    playSound(targetPlayer, 'mob.villager.no');
}

interface MuteCommandArgs {
    target?: mc.Player[];
    duration?: string;
    reason?: string;
}

const muteCommand: CustomCommand = {
    name: 'mute',
    description: 'Mutes a player for a specified duration with a reason.',
    category: 'Moderation',
    aliases: ['silence'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'duration', type: 'string', optional: true },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: MuteCommandArgs) => {
        const targetPlayers = args.target;
        let { duration, reason } = args;

        if (!targetPlayers || targetPlayers.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }
        const targetPlayer = targetPlayers[0];

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        mutePlayer(executor, targetPlayer, duration, reason || 'No reason provided.');
    }
};

export function unmutePlayer(executor: CommandExecutor, targetName: string) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cPlayer "${targetName}" has never joined the server or name is misspelled.`, executor);
        } else {
            executor.sendMessage(`§cPlayer "${targetName}" has never joined the server or name is misspelled.`);
        }
        return;
    }
    if (executor instanceof mc.Player) {
        if (targetId === executor.id) {
            sendMessage('§cYou cannot unmute yourself.', executor);
            return;
        }
        const executorData = getPlayer(executor.id);
        const targetData = loadPlayerData(targetId);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', executor);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot unmute a player with the same or higher rank than you.', executor);
            return;
        }
    }
    removePunishment(targetId, 'mute');

    if (executor instanceof mc.Player) {
        sendMessage(`§aSuccessfully unmuted ${targetName}.`, executor);
        playSound(executor, constants.soundTeleport);
    } else {
        executor.sendMessage(`§aSuccessfully unmuted ${targetName}.`);
    }

    const targetPlayer = findPlayerByName(targetName);
    if (targetPlayer) {
        sendMessage('§aYou have been unmuted and can now chat again.', targetPlayer);
        playSound(targetPlayer, 'random.levelup');
    }
}

const unmuteCommand: CustomCommand = {
    name: 'unmute',
    description: 'Unmutes a player.',
    category: 'Moderation',
    aliases: ['um'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        unmutePlayer(executor, args.target as string);
    }
};

export default [muteCommand, unmuteCommand];
