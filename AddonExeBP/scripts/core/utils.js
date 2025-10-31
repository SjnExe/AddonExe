import { system, world } from '@minecraft/server';
import { getEconomyConfig } from './configurations.js';
import { errorLog } from './logger.js';

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
    const initialLocation = { x: player.location.x, y: player.location.y, z: player.location.z };
    const dimensionId = player.dimension.id;
    let intervalId = null;
    let hurtListener = null;

    const cleanup = () => {
        if (intervalId !== null) {
            system.clearRun(intervalId);
            intervalId = null;
        }
        if (hurtListener) {
            world.afterEvents.entityHurt.unsubscribe(hurtListener);
            hurtListener = null;
        }
    };

    hurtListener = world.afterEvents.entityHurt.subscribe(event => {
        if (event.hurtEntity.id === player.id) {
            player.onScreenDisplay.setActionBar('§cTeleport canceled because you took damage.');
            cleanup();
        }
    }, { entityTypes: ['minecraft:player'] });

    player.sendMessage(`§aTeleporting to ${teleportName} in ${durationSeconds} seconds. Don't move or take damage!`);

    intervalId = system.runInterval(() => {
        try {
            // It's possible the player was killed or disconnected, which would invalidate the object.
            // A simple property access will throw if the player object is no longer valid.
            const currentLocation = player.location;

            // Check the 3D distance the player has moved.
            const distanceMoved = Math.sqrt(
                Math.pow(currentLocation.x - initialLocation.x, 2) +
                Math.pow(currentLocation.y - initialLocation.y, 2) +
                Math.pow(currentLocation.z - initialLocation.z, 2)
            );

            if (distanceMoved > 2 || player.dimension.id !== dimensionId) {
                player.onScreenDisplay.setActionBar('§cTeleport canceled because you moved.');
                cleanup();
                return;
            }

            remainingSeconds--;

            if (remainingSeconds > 0) {
                const color = getCountdownColor(remainingSeconds);
                player.onScreenDisplay.setActionBar(`${color}Teleporting in ${remainingSeconds}...`);
            } else {
                player.onScreenDisplay.setActionBar('§aTeleporting...');
                cleanup();
                onWarmupComplete();
            }
        } catch (e) {
            errorLog(`[Warmup] Error during warmup interval for ${player.name}: ${e}`);
            cleanup();
        }
    }, 20);
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

export function formatCooldown(seconds) {
    if (seconds <= 0) {
        return 'Ready';
    }

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    let result = '';
    if (d > 0) {
        result += `${d}d `;
    }
    if (h > 0) {
        result += `${h}h `;
    }
    if (m > 0) {
        result += `${m}m `;
    }
    if (s > 0) {
        result += `${s}s`;
    }

    return result.trim();
}

/**
 * Generates a clean, human-readable display name from an item's type ID.
 * Example: 'minecraft:diamond_sword' becomes 'Diamond Sword'.
 * @param {string} typeId The item's type ID.
 * @returns {string} A formatted display name.
 */
export function generateDisplayName(typeId) {
    if (!typeId) {
        return 'Unknown Item';
    }

    // Remove the namespace (e.g., 'minecraft:')
    const nameWithoutNamespace = typeId.includes(':') ? typeId.split(':')[1] : typeId;

    // Replace underscores with spaces and capitalize each word
    const formattedName = nameWithoutNamespace
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return formattedName;
}

/**
 * Formats a number as a currency string, using the symbol from the config.
 * @param {number} amount The amount to format.
 * @returns {string} The formatted currency string (e.g., "$1,234.50").
 */
export function formatCurrency(amount) {
    const economyConfig = getEconomyConfig();
    const symbol = economyConfig.currencySymbol || '$';
    const formattedAmount = amount.toFixed(2);
    return `${symbol}${formattedAmount}`;
}
