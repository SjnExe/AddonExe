import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { config } from '@core/../config.js';
import { soundError, soundTeleport } from '@core/constants.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { canTarget } from '@core/rankManager.js';
import { playSound } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';

export function kickPlayer(executor: CommandExecutor, targetPlayer: mc.Player | undefined, reason: string) {
    if (!isDefined(targetPlayer)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cPlayer not found.', executor);
            playSound(executor, soundError);
        } else {
            executor.sendMessage('§cPlayer not found.');
        }
        return;
    }

    if (executor instanceof mc.Player && executor.id === targetPlayer.id) {
        sendMessage('§cYou cannot kick yourself.', executor);
        playSound(executor, soundError);
        return;
    }

    if (!canTarget(executor, targetPlayer.id, config)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cYou cannot kick a player with the same or higher rank than you.', executor);
            playSound(executor, soundError);
        } else {
            executor.sendMessage('§cYou cannot kick a player with the same or higher rank than you.');
        }
        return;
    }

    try {
        const sanitizedReason = reason.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
        const commandToRun = `kick "${targetPlayer.name}" ${sanitizedReason}`;
        mc.world.getDimension('overworld').runCommand(commandToRun);
        if (executor instanceof mc.Player) {
            sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`, executor);
            playSound(executor, soundTeleport);
        } else {
            executor.sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`);
        }
    } catch (error: unknown) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cFailed to kick ${targetPlayer.name}. See console for details.`, executor);
            playSound(executor, soundError);
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
    permissionNode: 'cmd.kick.mod',
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'reason', type: 'text', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const { target: targetName, reason = 'No reason provided' } = args as unknown as KickCommandArgs;
        const targetPlayer = findPlayerByName(targetName);
        if (isDefined(targetPlayer)) {
            kickPlayer(executor, targetPlayer, reason);
        } else {
            kickPlayer(executor, undefined, reason);
        }
    }
};

export default kickCommand;
