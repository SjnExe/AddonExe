import { world, system } from '@minecraft/server';
import { getConfig } from './configManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';

const cooldownDbKey = 'exe:cooldowns';
const saveIntervalTicks = 6000; // Every 5 minutes

/** @type {Map<string, number>} */
let cooldowns = new Map();
let needsSave = false;

/**
 * Loads cooldowns from world dynamic properties.
 */
export function loadCooldowns() {
    debugLog('[CooldownManager] Loading cooldowns...');
    const dataStr = world.getDynamicProperty(cooldownDbKey);
    if (dataStr) {
        try {
            const parsedData = JSON.parse(dataStr);
            // Reconstruct the Map from the saved array
            cooldowns = new Map(parsedData);
            debugLog(`[CooldownManager] Loaded ${cooldowns.size} cooldowns.`);
        } catch (e) {
            errorLog('[CooldownManager] Failed to parse cooldown data from world property.', e);
            cooldowns = new Map();
        }
    }
}

/**
 * Saves cooldowns to world dynamic properties if a change has occurred.
 */
function saveCooldowns() {
    if (!needsSave) {return;}
    try {
        // Convert Map to an array for JSON serialization
        const dataToSave = Array.from(cooldowns.entries());
        world.setDynamicProperty(cooldownDbKey, JSON.stringify(dataToSave));
        needsSave = false;
        debugLog('[CooldownManager] Saved cooldowns to world properties.');
    } catch (e) {
        errorLog('[CooldownManager] Failed to save cooldowns.', e);
    }
}

/**
 * Iterates through all cooldowns and removes any that have expired.
 * This is for proactive cleanup to prevent the cooldown map from growing indefinitely.
 */
export function clearExpiredCooldowns() {
    const now = Date.now();
    let clearedCount = 0;
    for (const [key, expiry] of cooldowns.entries()) {
        if (now >= expiry) {
            cooldowns.delete(key);
            clearedCount++;
        }
    }
    if (clearedCount > 0) {
        needsSave = true;
        debugLog(`[CooldownManager] Cleared ${clearedCount} expired cooldowns.`);
    }
}

function getCooldownKey(playerId, identifier) {
    return `${playerId}:${identifier}`;
}

/**
 * Sets a cooldown for a player for a specific command defined in the config.
 * @param {import('@minecraft/server').Player} player
 * @param {string} commandName The name of the command (must have a section in config.js).
 */
export function setCooldown(player, commandName) {
    const config = getConfig();
    const commandConfig = config[commandName];
    if (!commandConfig || !commandConfig.cooldownSeconds) {return;}

    const cooldownSeconds = commandConfig.cooldownSeconds;
    setCooldownCustom(player.id, commandName, cooldownSeconds);
}

/**
 * Sets a custom cooldown for a player for a specific identifier.
 * @param {string} playerId
 * @param {string} identifier A unique name for the cooldown (e.g., a command name).
 * @param {number} durationSeconds The length of the cooldown in seconds.
 */
export function setCooldownCustom(playerId, identifier, durationSeconds) {
    if (durationSeconds <= 0) {return;}
    const key = getCooldownKey(playerId, identifier);
    const cooldownMs = durationSeconds * 1000;
    const expiry = Date.now() + cooldownMs;
    cooldowns.set(key, expiry);
    needsSave = true;
    // eslint-disable-next-line no-console
    console.warn(`[COOLDOWN DEBUG] Setting cooldown. Key: "${key}", Duration: ${durationSeconds}s, Expiry: ${expiry}`);
}

/**
 * Gets the remaining cooldown for a player for a specific identifier.
 * @param {string} playerId
 * @param {string} identifier A unique name for the cooldown (e.g., a command name).
 * @returns {number} Remaining cooldown in seconds, or 0 if available.
 */
export function getCooldown(playerId, identifier) {
    const key = getCooldownKey(playerId, identifier);
    const expiry = cooldowns.get(key);

    // eslint-disable-next-line no-console
    console.warn(`[COOLDOWN DEBUG] Getting cooldown. Key: "${key}", Expiry found: ${expiry}`);

    if (!expiry) {return 0;}

    const now = Date.now();
    if (now >= expiry) {
        cooldowns.delete(key);
        needsSave = true;
        // eslint-disable-next-line no-console
        console.warn(`[COOLDOWN DEBUG] Cooldown expired or is in the past. Returning 0.`);
        return 0;
    }

    const remaining = Math.ceil((expiry - now) / 1000);
    // eslint-disable-next-line no-console
    console.warn(`[COOLDOWN DEBUG] Cooldown active. Remaining: ${remaining}s`);
    return remaining;
}

// Periodically clear expired cooldowns and save to the world
system.runInterval(() => {
    clearExpiredCooldowns();
    saveCooldowns();
}, saveIntervalTicks);
