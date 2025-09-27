import { world, system } from '@minecraft/server';
import { getConfig } from './configManager.js';
import { saveAllData } from './dataManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
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

    world.sendMessage(`§l§c[SERVER] Attention! Restart initiated by ${announcer}. The server will restart in ${countdownSeconds} seconds.`);
    initiator.sendMessage('§aYou have initiated the server restart sequence.');

    // Use the tracked interval function
    countdownIntervalId = setTrackedInterval(() => {
        if (countdownTimer > 0) {
            const message = `§l§cServer restarting in ${countdownTimer}...`;
            // Use action bar for a less intrusive, constant reminder
            for (const player of world.getAllPlayers()) {
                player.onScreenDisplay.setActionBar(message);
            }

            // Announce in chat at key moments
            if (countdownTimer === 30 || countdownTimer === 15 || countdownTimer === 10 || countdownTimer <= 5) {
                world.sendMessage(message);
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
    world.sendMessage('§l§c[SERVER] Finalizing restart... saving all data now.');

    saveAllData({ log: true });

    // Use a short delay to allow the "saving" message to be seen
    setTrackedTimeout(() => {
        debugLog('[RestartManager] Kicking non-admin players.');
        const config = getConfig();
        const kickMessage = config.restart?.kickMessage ?? 'Server is restarting.';

        try {
            const ownerNames = config.ownerPlayerNames.map(name => `name=!"${name}"`).join(',');
            const command = `kick @a[tag=!${config.adminTag},${ownerNames}] ${kickMessage}`;

            debugLog(`[RestartManager] Running kick command: /${command}`);
            world.getDimension('overworld').runCommand(command);
            debugLog('[RestartManager] Kick command finished.');

            // Send a message to any remaining (admin/owner) players.
            for (const player of world.getAllPlayers()) {
                player.sendMessage('§aYou were not kicked by the restart sequence because you are an admin/owner.');
            }
        } catch (error) {
            errorLog(`[RestartManager] Failed to execute kick command: ${error}`);
        }

        errorLog('[AddonExe] SERVER IS READY FOR RESTART. Data has been saved and players have been kicked.');

        restartInProgress = false; // Reset the flag
    }, 60); // 3-second delay
}
