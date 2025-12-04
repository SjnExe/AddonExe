import * as mc from '@minecraft/server';

import { constants } from '@core/constants.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { playSound } from '@core/utils.js';

import { CustomCommand, CommandExecutor } from '@modules/commands/commandManager.js';

export function kickPlayer(executor: CommandExecutor, targetPlayer: mc.Player, reason: string) {
    if (!targetPlayer) {
        if (executor instanceof mc.Player) {
            sendMessage('§cPlayer not found.', executor);
            playSound(executor, constants.soundError);
        } else {
            executor.sendMessage('§cPlayer not found.');
        }
        return;
    }

    if (executor instanceof mc.Player && executor.id === targetPlayer.id) {
        sendMessage('§cYou cannot kick yourself.', executor);
        playSound(executor, constants.soundError);
        return;
    }

    if (executor instanceof mc.Player) {
        const executorData = getPlayer(executor.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', executor);
            playSound(executor, constants.soundError);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot kick a player with the same or higher rank than you.', executor);
            playSound(executor, constants.soundError);
            return;
        }
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        const commandToRun = `kick "${targetPlayer.name}" ${sanitizedReason}`;
        mc.world.getDimension('overworld').runCommand(commandToRun);
        if (executor instanceof mc.Player) {
            sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`, executor);
            playSound(executor, constants.soundTeleport);
        } else {
            executor.sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`);
        }
    } catch (error: unknown) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cFailed to kick ${targetPlayer.name}. See console for details.`, executor);
            playSound(executor, constants.soundError);
        } else {
            executor.sendMessage(`§cFailed to kick ${targetPlayer.name}. See console for details.`);
        }
        if (error instanceof Error) {
            errorLog(`[/kick] Failed to run kick command for ${targetPlayer.name}:`, error);
        }
    }
}

interface KickCommandArgs {
    target: string;
    reason?: string;
}

const kickCommand: CustomCommand = {
    name: 'kick',
    slashName: 'xkick',
    description: 'Kicks a player from the server.',
    category: 'Moderation',
    aliases: ['boot'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const { target: targetName, reason = 'No reason provided' } = args as unknown as KickCommandArgs;
        const targetPlayer = findPlayerByName(targetName);
        if (targetPlayer) {
            kickPlayer(executor, targetPlayer, reason);
        }
    }
};

export default kickCommand;
