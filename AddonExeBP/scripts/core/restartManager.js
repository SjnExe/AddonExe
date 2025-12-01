import * as mc from '@minecraft/server';
import { getConfig } from './configManager.js';
import { getPlayerRank } from './rankManager.js';
import { saveAllData } from './dataManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './logger.js';
import { setTrackedInterval, clearTrackedInterval, setTrackedTimeout } from './timerManager.js';

let restartInProgress = false;
let countdownTimer = -1;
let countdownIntervalId = -1;

/**
 * Starts the server restart sequence.
 * @param {import('@minecraft/server').Player} initiator The player who started the restart.
 */
export function startRestart(initiator) {
    if (restartInProgress) {
        initiator.sendMessage('§cRestart is already in progress.');
        return;
    }

    const config = getConfig();
    const countdownSeconds = config.restart?.countdownSeconds ?? 30;
    const announcer = initiator.isConsole ? 'The Console' : initiator.name;

    restartInProgress = true;
    countdownTimer = countdownSeconds;

    mc.world.sendMessage(`§l§c[SERVER] Attention! Restart initiated by ${announcer}. The server will restart in ${countdownSeconds} seconds.`);
    initiator.sendMessage('§aYou have initiated the server restart sequence.');

    // Use the tracked interval function
    countdownIntervalId = setTrackedInterval(() => {
        if (countdownTimer > 0) {
            const message = `§l§cServer restarting in ${countdownTimer}...`;

            // Calculate pitch: Starts at 0.5, ends at 2.0
            const progress = (countdownSeconds - countdownTimer) / countdownSeconds;
            const pitch = 0.5 + (progress * 1.5);

            for (const player of mc.world.getAllPlayers()) {
                // Action Bar
                player.onScreenDisplay.setActionBar(message);

                // Sound Effect
                player.playSound('note.pling', { pitch: pitch, volume: 1.0 });

                // Big Title for last 5 seconds
                if (countdownTimer <= 5) {
                    player.onScreenDisplay.setTitle(`§c${countdownTimer}`);
                    player.onScreenDisplay.updateSubtitle('§eServer Restarting...');
                }
            }

            // Announce in chat at key moments
            if (countdownTimer === 30 || countdownTimer === 15 || countdownTimer === 10 || countdownTimer <= 5) {
                mc.world.sendMessage(message);
            }

            countdownTimer--;
        } else {
            // Time's up
            clearTrackedInterval(countdownIntervalId); // Use the tracked clear function
            countdownIntervalId = -1; // Reset ID
            finalizeRestart();
        }
    }, 20); // Run every second
}

/**
 * Finalizes the restart: saves data, kicks players, and logs to console.
 */
function finalizeRestart() {
    debugLog('[RestartManager] Finalizing server restart...');
    mc.world.sendMessage('§l§c[SERVER] Finalizing restart... saving all data now.');

    saveAllData({ log: true });

    // Use a short delay to allow the "saving" message to be seen
    setTrackedTimeout(() => {
        debugLog('[RestartManager] Kicking non-admin players.');
        const config = getConfig();
        const kickMessage = config.restart?.kickMessage ?? 'Server is restarting.';

        try {
            // Play a final sound
            for (const player of mc.world.getAllPlayers()) {
                player.playSound('random.levelup', { pitch: 1.0, volume: 1.0 });
            }

            // Iterate players and kick based on permission level
            const players = mc.world.getAllPlayers();
            const overworld = mc.world.getDimension('overworld');
            for (const player of players) {
                const rank = getPlayerRank(player, config);
                // Permission Level 0 = Owner, 1 = Admin. Higher is lower rank.
                if (rank.permissionLevel > 1) {
                    try {
                        // Use dimension to run command so it runs with server permissions
                        overworld.runCommand(`kick "${player.name}" ${kickMessage}`);
                    } catch (kickError) {
                        errorLog(`[RestartManager] Failed to kick ${player.name}: ${kickError}`);
                    }
                } else {
                    player.sendMessage('§aYou were not kicked by the restart sequence because you are an admin/owner.');
                }
            }

            debugLog('[RestartManager] Kick sequence finished.');

        } catch (error) {
            errorLog(`[RestartManager] Critical error during kick sequence: ${error}`);
        }

        errorLog('[AddonExe] SERVER IS READY FOR RESTART. Data has been saved and players have been kicked.');

        restartInProgress = false; // Reset the flag
    }, 60); // 3-second delay
}
