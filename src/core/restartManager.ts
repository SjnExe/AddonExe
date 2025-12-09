import * as mc from '@minecraft/server';

import { CommandExecutor } from '@commands/commandManager.js';

import { getConfig } from './configManager.js';
import { saveAllData } from './dataManager.js';
import { debugLog, errorLog } from './logger.js';
import { getPlayerRank } from './rankManager.js';
import { clearTrackedInterval, setTrackedInterval, setTrackedTimeout } from './timerManager.js';

let restartInProgress = false;
let countdownTimer = -1;
let countdownIntervalId = -1;

/**
 * Starts the server restart sequence.
 * @param initiator The player or console that started the restart.
 */
export function startRestart(initiator: CommandExecutor): void {
    if (restartInProgress) {
        initiator.sendMessage('§cRestart is already in progress.');
        return;
    }

    const config = getConfig();
    if (!config) {
        errorLog('[RestartManager] Failed to get config. Aborting restart.');
        initiator.sendMessage('§cInternal error: Could not load configuration to start restart.');
        return;
    }
    const countdownSeconds = config.restart?.countdownSeconds ?? 30;
    const subtitle = config.restart?.subtitle ?? '§eServer Restarting...';
    const announcer = initiator instanceof mc.Player ? initiator.name : 'Console';

    restartInProgress = true;
    countdownTimer = countdownSeconds;

    mc.world.sendMessage(
        `§l§c[SERVER] Attention! Restart initiated by ${announcer}. The server will restart in ${countdownSeconds} seconds.`
    );
    initiator.sendMessage('§aYou have initiated the server restart sequence.');

    countdownIntervalId = setTrackedInterval(() => {
        if (countdownTimer > 0) {
            const message = `§l§cServer restarting in ${countdownTimer}...`;

            const progress = (countdownSeconds - countdownTimer) / countdownSeconds;
            const pitch = 0.5 + progress * 1.5;

            for (const player of mc.world.getAllPlayers()) {
                player.onScreenDisplay.setActionBar(message);
                player.playSound('note.pling', { pitch: pitch, volume: 1.0 });

                if (countdownTimer <= 5) {
                    player.onScreenDisplay.setTitle(`§c${countdownTimer}`);
                    player.onScreenDisplay.updateSubtitle(subtitle);
                }
            }

            if (countdownTimer === 30 || countdownTimer === 15 || countdownTimer === 10 || countdownTimer <= 5) {
                mc.world.sendMessage(message);
            }

            countdownTimer--;
        } else {
            clearTrackedInterval(countdownIntervalId);
            countdownIntervalId = -1;
            finalizeRestart();
        }
    }, 20); // Run every second
}

/**
 * Finalizes the restart: saves data, kicks players, and logs to console.
 */
function finalizeRestart(): void {
    debugLog('[RestartManager] Finalizing server restart...');
    mc.world.sendMessage('§l§c[SERVER] Finalizing restart... saving all data now.');

    saveAllData({ log: true });

    setTrackedTimeout(() => {
        debugLog('[RestartManager] Kicking non-admin players.');
        const config = getConfig();
        const kickMessage = config?.restart?.kickMessage ?? 'Server is restarting.';

        try {
            for (const player of mc.world.getAllPlayers()) {
                player.playSound('random.levelup', { pitch: 1.0, volume: 1.0 });
            }

            const players = mc.world.getAllPlayers();
            const overworld = mc.world.getDimension('overworld');
            for (const player of players) {
                const rank = getPlayerRank(player, config);
                // Permission Level 0 = Owner, 1 = Admin. Higher is lower rank.
                if (rank.permissionLevel > 1) {
                    try {
                        overworld.runCommand(`kick "${player.name}" ${kickMessage}`);
                    } catch (kickError) {
                        errorLog(`[RestartManager] Failed to kick ${player.name}: ${String(kickError)}`);
                    }
                } else {
                    player.sendMessage('§aYou were not kicked by the restart sequence because you are an admin/owner.');
                }
            }
            debugLog('[RestartManager] Kick sequence finished.');
        } catch (error) {
            errorLog(`[RestartManager] Critical error during kick sequence: ${String(error)}`);
        }

        errorLog('[AddonExe] SERVER IS READY FOR RESTART. Data has been saved and players have been kicked.');
        restartInProgress = false; // Reset the flag
    }, 60); // 3-second delay
}
