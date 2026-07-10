import { setTrackedInterval } from "@core/timerManager.js";
import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { escapeCommandArg } from '@core/utils/sanitization.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

interface AnticheatLogsService {
    addPunishmentLog: (playerName: string, type: string, reason: string, adminName: string, duration?: string) => void;
}

const storage = new StorageManager('exe:punishments');

export type PunishmentType = 'mute' | 'ban';

export interface Punishment {
    type: PunishmentType;
    expires: number;
    reason: string;
}

export interface PlayerPunishmentRecord {
    mute?: Punishment;
    ban?: Punishment;
}

// Stores punishments by Player ID -> Record
let punishments = new Map<string, PlayerPunishmentRecord>();
let needsSave = false;

/**
 * Loads punishment data from world dynamic properties.
 * Handles migration from legacy single-punishment format.
 */
export function loadPunishments() {
    debugLog('[PunishmentManager] Loading punishments...');
    // Try loading new format first
    const data = storage.load<[string, PlayerPunishmentRecord | Punishment][]>();

    if (isDefined(data)) {
        punishments = new Map();
        let migratedCount = 0;

        for (const [playerId, record] of data) {
            // Check if legacy format (has 'type' property directly)
            if ('type' in record) {
                const legacyPunishment = record;
                if (legacyPunishment.type === 'ban') {
                    punishments.set(playerId, { ban: legacyPunishment });
                } else {
                    punishments.set(playerId, { mute: legacyPunishment });
                }
                migratedCount++;
            } else {
                punishments.set(playerId, record);
            }
        }

        if (migratedCount > 0) {
            debugLog(`[PunishmentManager] Migrated ${migratedCount} legacy punishments.`);
            needsSave = true;
            savePunishments();
        }

        debugLog(`[PunishmentManager] Loaded ${punishments.size} punishment records.`);
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

    for (const [playerId, record] of punishments.entries()) {
        let changed = false;

        if (isDefined(record.ban) && now > record.ban.expires) {
            delete record.ban;
            changed = true;
            clearedCount++;
        }
        if (isDefined(record.mute) && now > record.mute.expires) {
            delete record.mute;
            changed = true;
            clearedCount++;
        }

        if (changed) {
            if (!isDefined(record.ban) && !isDefined(record.mute)) {
                punishments.delete(playerId);
            } else {
                punishments.set(playerId, record);
            }
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
        const dataToSave = [...punishments.entries()];
        storage.save(dataToSave);
        needsSave = false;
        debugLog('[PunishmentManager] Saved punishments to world properties.');
    } catch (error) {
        errorLog('[PunishmentManager] Failed to save punishments.', error);
    }
}

/**
 * Adds or updates a punishment for a player.
 * @param playerId The ID of the player.
 * @param playerName The name of the player (for logging).
 * @param punishment The punishment details.
 * @param adminName The name of the admin who issued the punishment.
 */
export function addPunishment(playerId: string, playerName: string, punishment: Punishment, adminName: string) {
    const record = punishments.get(playerId) ?? {};

    if (punishment.type === 'ban') {
        record.ban = punishment;
    } else {
        record.mute = punishment;
    }

    punishments.set(playerId, record);
    needsSave = true;
    savePunishments(); // Save immediately for critical actions
    debugLog(`[PunishmentManager] Added ${punishment.type} for player ${playerName} (${playerId}). Expires: ${new Date(punishment.expires).toLocaleString()}`);
    const durationStr = punishment.expires === Infinity ? 'Permanent' : new Date(punishment.expires).toLocaleString();
    const logService = serviceLocator.getService<AnticheatLogsService>('anticheat.logs');
    if (logService) {
        logService.addPunishmentLog(playerName, punishment.type, punishment.reason, adminName, durationStr);
    }
}

/**
 * Gets a player's active punishment of a specific type.
 * It also clears the punishment if it has expired.
 * @param playerId The ID of the player.
 * @param type The type of punishment to retrieve.
 */
export function getPunishment(playerId: string, type: PunishmentType): Punishment | undefined {
    const record = punishments.get(playerId);
    if (!isDefined(record)) {
        return undefined;
    }

    const punishment = type === 'ban' ? record.ban : record.mute;
    if (!isDefined(punishment)) {
        return undefined;
    }

    if (Date.now() > punishment.expires) {
        debugLog(`[PunishmentManager] ${type} for player ${playerId} has expired. Removing.`);
        removePunishment(playerId, type);
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
    const punishment = getPunishment(player.id, 'ban');
    if (isDefined(punishment)) {
        const banReason = isNonEmptyString(punishment.reason) ? punishment.reason : 'You are banned.';
        const safeReason = escapeCommandArg(banReason);
        const safePlayerName = escapeCommandArg(player.name);
        // Use a slight delay to ensure the kick command processes after join
        mc.system.runTimeout(() => mc.world.getDimension('overworld').runCommand(`kick "${safePlayerName}" "${safeReason}"`), 5);
        return true;
    }
    return false;
}

/**
 * Removes a punishment for a player.
 * @param playerId The ID of the player to unpunish.
 * @param type The type of punishment to remove.
 */
export function removePunishment(playerId: string, type: PunishmentType) {
    const record = punishments.get(playerId);
    if (!isDefined(record)) return;

    let changed = false;

    if (type === 'ban') {
        if (isDefined(record.ban)) {
            delete record.ban;
            changed = true;
        }
    } else {
        if (isDefined(record.mute)) {
            delete record.mute;
            changed = true;
        }
    }

    if (changed) {
        if (!isDefined(record.ban) && !isDefined(record.mute)) {
            punishments.delete(playerId);
        } else {
            punishments.set(playerId, record);
        }
        needsSave = true;
        savePunishments(); // Save immediately for critical actions
        debugLog(`[PunishmentManager] Removed ${type} for player ${playerId}.`);
    }
}

/**
 * Initializes the punishment manager's periodic tasks.
 */
export function initializePunishmentManager() {
    // Periodically clear expired punishments and save to the world
    const config = getConfig();
    setTrackedInterval(() => {
        clearExpiredPunishments();
        savePunishments();
    }, config.data.autoSaveIntervalSeconds * 20);
}
