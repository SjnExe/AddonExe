import { system } from '@minecraft/server';
import { getConfig } from './configManager.js';
import { errorLog } from './errorLogger.js';

/**
 * Parses a duration string (e.g., "10m", "2h", "7d") and returns the duration in milliseconds.
 * @param {string} durationString The duration string to parse.
 * @returns {number} The duration in milliseconds, or 0 if the format is invalid.
 */
export function parseDuration(durationString) {
    const durationRegex = /^(\d+)([smhdw])$/;
    const match = durationString.toLowerCase().match(durationRegex);

    if (!match) {
        return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    let multiplier = 0;

    switch (unit) {
        case 's':
            multiplier = 1000;
            break;
        case 'm':
            multiplier = 1000 * 60;
            break;
        case 'h':
            multiplier = 1000 * 60 * 60;
            break;
        case 'd':
            multiplier = 1000 * 60 * 60 * 24;
            break;
        case 'w':
            multiplier = 1000 * 60 * 60 * 24 * 7;
            break;
    }

    return value * multiplier;
}

/**
 * Plays a sound for a specific player.
 * @param {import('@minecraft/server').Player} player The player to play the sound for.
 * @param {string} soundId The ID of the sound to play.
 */
export function playSound(player, soundId) {
    try {
        player.playSound(soundId);
    } catch (e) {
        errorLog(`Failed to play sound "${soundId}" for player ${player.name}: ${e}`);
    }
}

/**
 * Shows a form to a player, handling the 'UserBusy' case by sending a one-time message and then retrying.
 * @param {import('@minecraft/server').Player} player The player to show the form to.
 * @param {import('@minecraft/server-ui').ActionFormData | import('@minecraft/server-ui').ModalFormData | import('@minecraft/server-ui').MessageFormData} form The form to show.
 * @returns {Promise<any>} A promise that resolves with the form response, or undefined if it times out or is cancelled for other reasons.
 */
export async function uiWait(player, form) {
    let firstAttempt = await form.show(player);
    if (firstAttempt.cancelationReason !== 'UserBusy') {
        return firstAttempt;
    }

    // If the first attempt failed because the UI was busy, send the message and start retrying.
    player.sendMessage('§eOpening UI... please close chat to view.§r');

    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < 1200) { // 1 minute timeout
        const subsequentAttempt = await form.show(player);
        if (subsequentAttempt.cancelationReason !== 'UserBusy') {
            return subsequentAttempt;
        }
    }

    return undefined; // Timeout
}

/**
 * Plays a configured sound for a player if it's enabled in the config.
 * @param {import('@minecraft/server').Player} player The player to play the sound for.
 * @param {keyof import('../config.js').config.soundEvents} soundEventKey The key of the sound event in the config.
 */
export function playSoundFromConfig(player, soundEventKey) {
    try {
        const config = getConfig();
        const soundEvent = config.soundEvents?.[soundEventKey];
        if (soundEvent && soundEvent.enabled) {
            player.playSound(soundEvent.soundId, {
                volume: soundEvent.volume,
                pitch: soundEvent.pitch
            });
        }
    } catch (error) {
        errorLog(`Failed to play sound from config for key "${soundEventKey}": ${error}`);
    }
}

/**
 * Determines the color for the countdown timer based on remaining seconds.
 * @param {number} secondsRemaining
 * @returns {string} The Minecraft color code.
 */
function getCountdownColor(secondsRemaining) {
    if (secondsRemaining <= 1) {return '§4';} // Dark Red
    if (secondsRemaining <= 3) {return '§c';} // Red
    if (secondsRemaining <= 5) {return '§6';} // Gold
    if (secondsRemaining <= 10) {return '§e';} // Yellow
    return '§a'; // Green
}

/**
 * Starts a teleport warmup timer for a player.
 * @param {import('@minecraft/server').Player} player The player to teleport.
 * @param {number} durationSeconds The duration of the warmup in seconds.
 * @param {() => void} onWarmupComplete The function to execute when the warmup completes successfully.
 * @param {string} teleportName A short name for the teleport type (e.g., "home", "spawn") for messages.
 */
export function startTeleportWarmup(player, durationSeconds, onWarmupComplete, teleportName = 'teleport') {
    if (durationSeconds <= 0) {
        onWarmupComplete();
        return;
    }

    let remainingSeconds = durationSeconds;
    const initialLocation = player.location;
    const dimension = player.dimension;
    let initialHealth;

    try {
        // Getting health can fail if the entity is not a player or if the component is not available for some reason.
        initialHealth = player.getComponent('health').currentValue;
    } catch {
        errorLog(`[Warmup] Could not get initial health for ${player.name}. Proceeding without damage check.`);
        initialHealth = Infinity; // Set to infinity to make the damage check always pass
    }

    player.sendMessage(`§aTeleporting to ${teleportName} in ${durationSeconds} seconds. Don't move or take damage!`);

    const intervalId = system.runInterval(() => {
        try {
            // Player might have logged off. The try-catch will prevent a crash.
            const currentLocation = player.location;

            // Check if player moved
            const distanceMoved = Math.sqrt(
                Math.pow(currentLocation.x - initialLocation.x, 2) +
                Math.pow(currentLocation.y - initialLocation.y, 2) +
                Math.pow(currentLocation.z - initialLocation.z, 2)
            );

            if (distanceMoved > 1.5 || player.dimension.id !== dimension.id) {
                system.clearRun(intervalId);
                player.onScreenDisplay.setActionBar('§cTeleport canceled because you moved.');
                return;
            }

            // Check for damage
            const currentHealth = player.getComponent('health').currentValue;
            if (currentHealth < initialHealth) {
                system.clearRun(intervalId);
                player.onScreenDisplay.setActionBar('§cTeleport canceled because you took damage.');
                return;
            }

            remainingSeconds--;

            if (remainingSeconds > 0) {
                const color = getCountdownColor(remainingSeconds);
                player.onScreenDisplay.setActionBar(`${color}Teleporting in ${remainingSeconds}...`);
            } else {
                system.clearRun(intervalId);
                player.onScreenDisplay.setActionBar('§aTeleporting...');
                onWarmupComplete();
            }
        } catch {
            // This will catch errors if the player object becomes invalid (e.g., player logs off)
            system.clearRun(intervalId);
        }
    }, 20); // Run every second
}

/**
 * Formats a string by replacing placeholders with values from a context object.
 * @param {string} template The string template with placeholders like {key}.
 * @param {object} context An object containing the values to substitute.
 * @returns {string} The formatted string.
 */
export function formatString(template, context) {
    if (!template) {
        return '';
    }
    // Replace \n with actual newlines first
    let message = template.replace(/\\n/g, '\n');

    // Replace placeholders
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            const placeholder = new RegExp(`{${key}}`, 'g');
            message = message.replace(placeholder, context[key]);
        }
    }
    return message;
}
