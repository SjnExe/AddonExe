import * as mc from '@minecraft/server';
import { getConfig } from './configManager.js';
import { getPlayerRank } from './rankManager.js';
import { saveAllData } from './dataManager.js';
import { debugLog, errorLog } from './logger.js';
import { setTrackedInterval, clearTrackedInterval, setTrackedTimeout } from './timerManager.js';
import { CommandExecutor } from '../modules/commands/commandManager.js';

let restartInProgress = false;
let countdownTimer = -1;
let countdownIntervalId = -1;

/**
 * Starts the server restart sequence.
 * @param initiator The player or console who started the restart.
 */
export function startRestart(initiator: CommandExecutor) {
    if (restartInProgress) {
        initiator.sendMessage('§cRestart is already in progress.');
        return;
    }

    const config = getConfig();
    const countdownSeconds = config.restart?.countdownSeconds ?? 30;
    const announcer = initiator instanceof mc.Player ? initiator.name : 'The Console';

    restartInProgress = true;
    countdownTimer = countdownSeconds;

    mc.world.sendMessage(`§l§c[SERVER] Attention! Restart initiated by ${announcer}. The server will restart in ${countdownSeconds} seconds.`);
    initiator.sendMessage('§aYou have initiated the server restart sequence.');

    countdownIntervalId = setTrackedInterval(() => {
        if (countdownTimer > 0) {
            const message = `§l§cServer restarting in ${countdownTimer}...`;

            const progress = (countdownSeconds - countdownTimer) / countdownSeconds;
            const pitch = 0.5 + (progress * 1.5);

            for (const player of mc.world.getAllPlayers()) {
                player.onScreenDisplay.setActionBar(message);
                player.playSound('note.pling', { pitch: pitch, volume: 1.0 });

                if (countdownTimer <= 5) {
                    player.onScreenDisplay.setTitle(`§c${countdownTimer}`);
                    player.onScreenDisplay.updateSubtitle('§eServer Restarting...');
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
    }, 20);
}

function finalizeRestart() {
    debugLog('[RestartManager] Finalizing server restart...');
    mc.world.sendMessage('§l§c[SERVER] Finalizing restart... saving all data now.');

    saveAllData({ log: true });

    setTrackedTimeout(() => {
        debugLog('[RestartManager] Kicking non-admin players.');
        const config = getConfig();
        const kickMessage = config.restart?.kickMessage ?? 'Server is restarting.';

        try {
            for (const player of mc.world.getAllPlayers()) {
                player.playSound('random.levelup', { pitch: 1.0, volume: 1.0 });
            }

            const players = mc.world.getAllPlayers();
            const overworld = mc.world.getDimension('overworld');
            for (const player of players) {
                const rank = getPlayerRank(player, config);
                if (rank.permissionLevel > 1) {
                    try {
                        overworld.runCommand(`kick "${player.name}" ${kickMessage}`);
                    } catch (kickError: any) {
                        errorLog(`[RestartManager] Failed to kick ${player.name}: ${kickError}`);
                    }
                } else {
                    player.sendMessage('§aYou were not kicked by the restart sequence because you are an admin/owner.');
                }
            }

            debugLog('[RestartManager] Kick sequence finished.');

        } catch (error: any) {
            errorLog(`[RestartManager] Critical error during kick sequence: ${error}`);
        }

        errorLog('[AddonExe] SERVER IS READY FOR RESTART. Data has been saved and players have been kicked.');

        restartInProgress = false;
    }, 60);
}
