import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { config } from '@core/../config.default.js';
import { frozenTag } from '@core/constants.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { canTarget } from '@core/rankManager.js';
import { playSound } from '@core/utils.js';

export function freezePlayer(executor: CommandExecutor, targetPlayer: mc.Player) {
    if (!canTarget(executor, targetPlayer.id, config)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cYou cannot freeze a player with the same or higher rank than you.', executor);
        } else {
            executor.sendMessage('§cYou cannot freeze a player with the same or higher rank than you.');
        }
        return;
    }

    if (targetPlayer.hasTag(frozenTag)) {
        if (executor instanceof mc.Player) {
            sendMessage(`§ePlayer ${targetPlayer.name} is already frozen.`, executor);
        } else {
            executor.sendMessage(`§ePlayer ${targetPlayer.name} is already frozen.`);
        }
        return;
    }
    try {
        // @ts-expect-error Beta types lack full signatures
        targetPlayer.inputPermissions.setCameraEnabled(false);
        // @ts-expect-error Beta types lack full signatures
        targetPlayer.inputPermissions.setMovementEnabled(false);
        targetPlayer.addTag(frozenTag);

        // Add invulnerability (Resistance 255)
        targetPlayer.addEffect('resistance', 20_000_000, { amplifier: 255, showParticles: false });
        // Add weakness to prevent attacking
        targetPlayer.addEffect('weakness', 20_000_000, { amplifier: 255, showParticles: false });

        playSound(targetPlayer, 'mob.stray.ambient');

        const announcer = executor instanceof mc.Player ? executor.name : 'the Console';
        if (executor instanceof mc.Player) {
            sendMessage(`§aSuccessfully froze ${targetPlayer.name}.`, executor);
            playSound(executor, 'random.orb');
        } else {
            executor.sendMessage(`§aSuccessfully froze ${targetPlayer.name}.`);
        }
        sendMessage(`§cYou have been frozen by ${announcer}.`, targetPlayer);
    } catch (error: unknown) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cFailed to freeze ${targetPlayer.name}.`, executor);
        } else {
            executor.sendMessage(`§cFailed to freeze ${targetPlayer.name}.`);
        }
        if (error instanceof Error) {
            errorLog(`[Freeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error.stack}`);
        }
    }
}

export function unfreezePlayer(executor: CommandExecutor, targetPlayer: mc.Player) {
    if (!canTarget(executor, targetPlayer.id, config)) {
        if (executor instanceof mc.Player) {
            sendMessage('§cYou cannot unfreeze a player with the same or higher rank than you.', executor);
        } else {
            executor.sendMessage('§cYou cannot unfreeze a player with the same or higher rank than you.');
        }
        return;
    }

    if (!targetPlayer.hasTag(frozenTag)) {
        if (executor instanceof mc.Player) {
            sendMessage(`§ePlayer ${targetPlayer.name} is not frozen.`, executor);
        } else {
            executor.sendMessage(`§ePlayer ${targetPlayer.name} is not frozen.`);
        }
        return;
    }
    try {
        // @ts-expect-error Beta types lack full signatures
        targetPlayer.inputPermissions.setCameraEnabled(true);
        // @ts-expect-error Beta types lack full signatures
        targetPlayer.inputPermissions.setMovementEnabled(true);
        targetPlayer.removeTag(frozenTag);

        // Remove effects
        targetPlayer.removeEffect('resistance');
        targetPlayer.removeEffect('weakness');

        playSound(targetPlayer, 'random.levelup');

        if (executor instanceof mc.Player) {
            sendMessage(`§aSuccessfully unfroze ${targetPlayer.name}.`, executor);
            playSound(executor, 'random.orb');
        } else {
            executor.sendMessage(`§aSuccessfully unfroze ${targetPlayer.name}.`);
        }
        sendMessage('§aYou have been unfrozen.', targetPlayer);
    } catch (error: unknown) {
        if (executor instanceof mc.Player) {
            sendMessage(`§cFailed to unfreeze ${targetPlayer.name}.`, executor);
        } else {
            executor.sendMessage(`§cFailed to unfreeze ${targetPlayer.name}.`);
        }
        if (error instanceof Error) {
            errorLog(`[Unfreeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error.stack}`);
        }
    }
}

interface FreezeCommandArgs {
    target?: mc.Player[];
}

const freezeCommand: CustomCommand = {
    name: 'freeze',
    description: 'Freezes a player, preventing them from moving or looking around.',
    category: 'Moderation',
    permissionNode: 'cmd.freeze',
    allowConsole: true,
    parameters: [{ name: 'target', type: 'player' }],
    execute: (executor: CommandExecutor, args: FreezeCommandArgs) => {
        const targetPlayers = args.target;
        if (!targetPlayers || targetPlayers.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }
        const targetPlayer = targetPlayers[0];
        if (!targetPlayer) {
            if (executor instanceof mc.Player) sendMessage('§cPlayer not found.', executor);
            else executor.sendMessage('§cPlayer not found.');
            return;
        }
        if (executor instanceof mc.Player && executor.id === targetPlayer.id) {
            sendMessage('§cYou cannot freeze yourself.', executor);
            return;
        }
        freezePlayer(executor, targetPlayer);
    }
};

const unfreezeCommand: CustomCommand = {
    name: 'unfreeze',
    description: 'Unfreezes a player, allowing them to move and look around again.',
    category: 'Moderation',
    permissionNode: 'cmd.unfreeze',
    allowConsole: true,
    parameters: [{ name: 'target', type: 'player' }],
    execute: (executor: CommandExecutor, args: FreezeCommandArgs) => {
        const targetPlayers = args.target;
        if (!targetPlayers || targetPlayers.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }
        const targetPlayer = targetPlayers[0];
        if (!targetPlayer) {
            if (executor instanceof mc.Player) sendMessage('§cPlayer not found.', executor);
            else executor.sendMessage('§cPlayer not found.');
            return;
        }
        unfreezePlayer(executor, targetPlayer);
    }
};

export default [freezeCommand, unfreezeCommand];
