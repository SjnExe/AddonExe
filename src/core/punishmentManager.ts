import * as mc from '@minecraft/server';
import { getConfig } from './configManager.js';
import { debugLog, errorLog } from './logger.js';

const punishmentDbKey = 'exe:punishments';

export type PunishmentType = 'mute' | 'ban';

export interface Punishment {
    type: PunishmentType;
    expires: number;
    reason: string;
}

let punishments = new Map<string, Punishment>();
let needsSave = false;

/**
 * Loads punishment data from world dynamic properties.
 */
export function loadPunishments() {
    debugLog('[PunishmentManager] Loading punishments...');
    const dataStr = mc.world.getDynamicProperty(punishmentDbKey);
    if (typeof dataStr === 'string') {
        try {
            const parsedData = JSON.parse(dataStr);
            // JSON stringifies a Map as an array of [key, value] pairs
            punishments = new Map(parsedData);
            debugLog(`[PunishmentManager] Loaded ${punishments.size} punishments.`);
        } catch (e) {
            errorLog('[PunishmentManager] Failed to parse punishment data from world property.', e);
            punishments = new Map();
        }
    }
}

/**
 * Iterates through all punishments and removes any that have expired.
 */
export function clearExpiredPunishments() {
    const now = Date.now();
    let clearedCount = 0;
    for (const [playerId, punishment] of punishments.entries()) {
        if (now > punishment.expires) {
            punishments.delete(playerId);
            clearedCount++;
        }
    }
    if (clearedCount > 0) {
        needsSave = true;
        debugLog(`[PunishmentManager] Cleared ${clearedCount} expired punishments.`);
    }
}

/**
 * Saves punishment data to world dynamic properties if a change has occurred.
 */
function savePunishments() {
    if (!needsSave) {return;}
    try {
        // JSON can't stringify a Map directly, so convert to an array first.
        const dataToSave = Array.from(punishments.entries());
        mc.world.setDynamicProperty(punishmentDbKey, JSON.stringify(dataToSave));
        needsSave = false;
        debugLog('[PunishmentManager] Saved punishments to world properties.');
    } catch (e) {
        errorLog('[PunishmentManager] Failed to save punishments.', e);
    }
}

/**
 * Adds or updates a punishment for a player.
 * @param playerId The ID of the player.
 * @param punishment The punishment details.
 */
export function addPunishment(playerId: string, punishment: Punishment) {
    punishments.set(playerId, punishment);
    needsSave = true;
    savePunishments(); // Save immediately for critical actions
    debugLog(`[PunishmentManager] Added ${punishment.type} for player ${playerId}. Expires: ${new Date(punishment.expires).toLocaleString()}`);
}

/**
 * Gets a player's active punishment.
 * It also clears the punishment if it has expired.
 * @param playerId The ID of the player.
 */
export function getPunishment(playerId: string): Punishment | undefined {
    const punishment = punishments.get(playerId);
    if (!punishment) {
        return undefined;
    }

    if (Date.now() > punishment.expires) {
        debugLog(`[PunishmentManager] Punishment for player ${playerId} has expired. Removing.`);
        removePunishment(playerId);
        return undefined;
    }

    return punishment;
}

/**
 * Removes a punishment for a player.
 * @param playerId The ID of the player to unpunish.
 */
export function removePunishment(playerId: string) {
    if (punishments.delete(playerId)) {
        needsSave = true;
        savePunishments(); // Save immediately for critical actions
        debugLog(`[PunishmentManager] Removed punishment for player ${playerId}.`);
    }
}

/**
 * Initializes the punishment manager's periodic tasks.
 */
export function initializePunishmentManager() {
    // Periodically clear expired punishments and save to the world
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = getConfig();
    mc.system.runInterval(() => {
        clearExpiredPunishments();
        savePunishments();
    }, (config.data?.autoSaveIntervalSeconds ?? 30) * 20);
}
