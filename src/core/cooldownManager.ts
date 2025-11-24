import * as mc from '@minecraft/server';
import { getConfig } from './configManager.js';
import { debugLog, errorLog } from './logger.js';

const cooldownDbKey = 'exe:cooldowns';
const saveIntervalTicks = 6000; // Every 5 minutes

/** Map<"playerId:identifier", expiryTimestamp> */
let cooldowns = new Map<string, number>();
let needsSave = false;

/**
 * Loads cooldowns from world dynamic properties.
 */
export function loadCooldowns() {
    debugLog('[CooldownManager] Loading cooldowns...');
    const dataStr = mc.world.getDynamicProperty(cooldownDbKey);
    if (typeof dataStr === 'string') {
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
        mc.world.setDynamicProperty(cooldownDbKey, JSON.stringify(dataToSave));
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

function getCooldownKey(playerId: string, identifier: string): string {
    return `${playerId}:${identifier}`;
}

/**
 * Sets a cooldown for a player for a specific command defined in the config.
 * @param player
 * @param commandName The name of the command (must have a section in config.js).
 */
export function setCooldown(player: mc.Player, commandName: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = getConfig();
    const commandConfig = config[commandName];
    if (!commandConfig || !commandConfig.cooldownSeconds) {return;}

    const cooldownSeconds = commandConfig.cooldownSeconds;
    setCooldownCustom(player.id, commandName, cooldownSeconds);
}

/**
 * Sets a custom cooldown for a player for a specific identifier.
 * @param playerId
 * @param identifier A unique name for the cooldown (e.g., a command name).
 * @param durationSeconds The length of the cooldown in seconds.
 */
export function setCooldownCustom(playerId: string, identifier: string, durationSeconds: number) {
    if (durationSeconds <= 0) {return;}
    const key = getCooldownKey(playerId, identifier);
    const cooldownMs = durationSeconds * 1000;
    cooldowns.set(key, Date.now() + cooldownMs);
    needsSave = true;
    // Cooldowns are saved periodically, no need to save immediately unless critical.
}

/**
 * Gets the remaining cooldown for a player for a specific identifier.
 * @param playerId
 * @param identifier A unique name for the cooldown (e.g., a command name).
 * @returns Remaining cooldown in seconds, or 0 if available.
 */
export function getCooldown(playerId: string, identifier: string): number {
    const key = getCooldownKey(playerId, identifier);
    const expiry = cooldowns.get(key);

    if (!expiry) {return 0;}

    const now = Date.now();
    if (now >= expiry) {
        cooldowns.delete(key);
        needsSave = true;
        return 0;
    }

    return Math.ceil((expiry - now) / 1000);
}

// Periodically clear expired cooldowns and save to the world
mc.system.runInterval(() => {
    clearExpiredCooldowns();
    saveCooldowns();
}, saveIntervalTicks);
