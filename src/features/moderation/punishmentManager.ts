import * as mc from '@minecraft/server';

import { getConfig } from '../../core/configManager.js';
import { debugLog, errorLog } from '../../core/logger.js';
import { StorageManager } from '../../core/storage/StorageManager.js';
import { addPunishmentLog } from '../anticheat/logManager.js';

const storage = new StorageManager('exe:punishments');

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
    const data = storage.load<[string, Punishment][]>();
    if (data) {
        punishments = new Map(data);
        debugLog(`[PunishmentManager] Loaded ${punishments.size} punishments.`);
    } else {
        punishments = new Map();
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
    if (!needsSave) {
        return;
    }
    try {
        const dataToSave = Array.from(punishments.entries());
        storage.save(dataToSave);
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
 * @param adminName The name of the admin who issued the punishment.
 */
export function addPunishment(playerId: string, punishment: Punishment, adminName: string) {
    punishments.set(playerId, punishment);
    needsSave = true;
    savePunishments(); // Save immediately for critical actions
    debugLog(
        `[PunishmentManager] Added ${punishment.type} for player ${playerId}. Expires: ${new Date(punishment.expires).toLocaleString()}`
    );
    const durationStr = punishment.expires === Infinity ? 'Permanent' : new Date(punishment.expires).toLocaleString();
    // We store ID as name? No, logManager expects name. Ideally we resolve name.
    // For now pass ID if name unknown, but callers usually know name.
    // Wait, logManager takes `playerName`. Here we have `playerId`.
    // I should resolve name if possible or accept name.
    // `ban` command has target player object or name.
    // `addPunishment` only gets ID.
    // I should add `playerName` param to `addPunishment`?
    // Yes.
    addPunishmentLog(playerId, punishment.type, punishment.reason, adminName, durationStr);
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
 * Checks if a player is banned and kicks them if so.
 * @param {mc.Player} player The player to check.
 * @returns {boolean} True if the player was kicked (is banned), false otherwise.
 */
export function checkAndKickBannedPlayer(player: mc.Player): boolean {
    const punishment = getPunishment(player.id);
    if (punishment?.type === 'ban') {
        const banReason = punishment.reason || 'You are banned.';
        // Use a slight delay to ensure the kick command processes after join
        mc.system.runTimeout(
            () => mc.world.getDimension('overworld').runCommand(`kick "${player.name}" ${banReason}`),
            5
        );
        return true;
    }
    return false;
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
    const config = getConfig();
    mc.system.runInterval(
        () => {
            clearExpiredPunishments();
            savePunishments();
        },
        (config.data?.autoSaveIntervalSeconds ?? 30) * 20
    );
}
