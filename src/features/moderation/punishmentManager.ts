import { CommandExecutor } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { registerDataSaver } from '@core/data/dataManager.js';
import { getPlayerIdByName, getPlayerNameById } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { soundError } from '@core/utils/constants.js';
import { playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { kickPlayer } from '@core/utils/player.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

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

/** Loads punishment data from world dynamic properties. Handles migration from legacy single-punishment format. */
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
        if (!Number.isFinite(legacyPunishment.expires) || legacyPunishment.expires <= 0) {
          legacyPunishment.expires = Infinity;
        }
        if (legacyPunishment.type === 'ban') {
          punishments.set(playerId, { ban: legacyPunishment });
        } else {
          punishments.set(playerId, { mute: legacyPunishment });
        }
        migratedCount++;
      } else {
        if (isDefined(record.ban) && (!Number.isFinite(record.ban.expires) || record.ban.expires <= 0)) {
          record.ban.expires = Infinity;
        }
        if (isDefined(record.mute) && (!Number.isFinite(record.mute.expires) || record.mute.expires <= 0)) {
          record.mute.expires = Infinity;
        }
        punishments.set(playerId, record);
      }
    }

    if (migratedCount > 0) {
      debugLog(`[PunishmentManager] Migrated ${migratedCount} legacy punishments.`);
      needsSave = true;
      savePunishments();
    }

    // Migrate legacy name-keyed punishments to player IDs if resolvable
    const isPunishmentActive = (p?: Punishment) =>
      isDefined(p) && (!Number.isFinite(p.expires) || Date.now() <= p.expires);

    const expiryOf = (p: Punishment) => (Number.isFinite(p.expires) ? p.expires : Infinity);
    const shouldReplace = (incoming: Punishment, current?: Punishment) =>
      !isDefined(current) || !isPunishmentActive(current) || expiryOf(incoming) > expiryOf(current);

    for (const [key, record] of [...punishments.entries()]) {
      const resolvedId = getPlayerIdByName(key);
      if (isDefined(resolvedId) && resolvedId !== key) {
        const existing = punishments.get(resolvedId) ?? {};
        let migratedAny = false;

        if (isDefined(record.ban) && shouldReplace(record.ban, existing.ban)) {
          existing.ban = record.ban;
          migratedAny = true;
        }
        if (isDefined(record.mute) && shouldReplace(record.mute, existing.mute)) {
          existing.mute = record.mute;
          migratedAny = true;
        }

        if (migratedAny) {
          punishments.set(resolvedId, existing);
          migratedCount++;
        }
        punishments.delete(key);
        needsSave = true;
      }
    }

    clearExpiredPunishments();
    if (needsSave) {
      savePunishments();
    }

    debugLog(`[PunishmentManager] Loaded ${punishments.size} punishment records.`);
  } else {
    punishments = new Map();
  }
}

/** Iterates through all punishments and removes any that have expired. */
export function clearExpiredPunishments() {
  const now = Date.now();
  let clearedCount = 0;

  for (const [playerId, record] of punishments.entries()) {
    let changed = false;

    if (
      isDefined(record.ban) &&
      typeof record.ban.expires === 'number' &&
      Number.isFinite(record.ban.expires) &&
      now > record.ban.expires
    ) {
      delete record.ban;
      changed = true;
      clearedCount++;
    }
    if (
      isDefined(record.mute) &&
      typeof record.mute.expires === 'number' &&
      Number.isFinite(record.mute.expires) &&
      now > record.mute.expires
    ) {
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

/** Saves punishment data to world dynamic properties if a change has occurred. */
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
 *
 * @param playerId The ID of the player.
 * @param playerName The name of the player (for logging).
 * @param punishment The punishment details.
 * @param adminName The name of the admin who issued the punishment.
 */
export function addPunishment(playerId: string, playerName: string, punishment: Punishment, adminName: string) {
  if (!Number.isFinite(punishment.expires) || punishment.expires <= 0) {
    punishment.expires = Infinity;
  }
  const record = punishments.get(playerId) ?? {};

  if (punishment.type === 'ban') {
    record.ban = punishment;
  } else {
    record.mute = punishment;
  }

  punishments.set(playerId, record);
  needsSave = true;
  savePunishments(); // Save immediately for critical actions
  const durationStr = punishment.expires === Infinity ? 'Permanent' : new Date(punishment.expires).toLocaleString();
  debugLog(
    `[PunishmentManager] Added ${punishment.type} for player ${playerName} (${playerId}). Expires: ${durationStr}`,
  );
  const logService = serviceLocator.getService<AnticheatLogsService>('anticheat.logs');
  if (logService) {
    logService.addPunishmentLog(playerName, punishment.type, punishment.reason, adminName, durationStr);
  }
}

/**
 * Removes a punishment from an exact key entry without affecting alias keys.
 *
 * @param key The exact Map key to remove from.
 * @param type The type of punishment to remove.
 * @param save Whether to persist to storage immediately. Defaults to true.
 * @returns True if a punishment record was modified or removed.
 */
function removePunishmentFromKey(key: string, type: PunishmentType, save = true): boolean {
  const record = punishments.get(key);
  if (!isDefined(record)) {
    return false;
  }

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
      punishments.delete(key);
    } else {
      punishments.set(key, record);
    }
    needsSave = true;
    if (save) {
      savePunishments();
    }
  }

  return changed;
}

/**
 * Resolves all candidate keys (verbatim, lowercase, resolved player name, and resolved entity ID) associated with a
 * player ID or name to prevent ghost punishments across ID-name key mismatches.
 *
 * @param playerIdOrName The player ID or name string to resolve candidate keys for.
 * @returns Set of unique identifier keys to check or mutate.
 */
function resolvePunishmentTargetKeys(playerIdOrName: string): Set<string> {
  const keys = new Set<string>([playerIdOrName, playerIdOrName.toLowerCase()]);
  const resolvedName = getPlayerNameById(playerIdOrName);
  if (isDefined(resolvedName)) {
    keys.add(resolvedName);
    keys.add(resolvedName.toLowerCase());
  }
  const resolvedId = getPlayerIdByName(playerIdOrName);
  if (isDefined(resolvedId)) {
    keys.add(resolvedId);
    keys.add(resolvedId.toLowerCase());
    const canonicalName = getPlayerNameById(resolvedId);
    if (isDefined(canonicalName)) {
      keys.add(canonicalName);
      keys.add(canonicalName.toLowerCase());
    }
  }
  return keys;
}

/**
 * Gets a player's active punishment of a specific type. It also clears the punishment if it has expired. Resolves
 * across player ID, username, and lowercase variations to detect legacy and alias records.
 *
 * @param playerId The ID or username of the player.
 * @param type The type of punishment to retrieve.
 * @returns The active Punishment object if found and unexpired, or undefined.
 */
export function getPunishment(playerId: string, type: PunishmentType): Punishment | undefined {
  // Fast path: check direct exact key first to bypass candidate set allocations for innocent players
  const directRecord = punishments.get(playerId);
  const directPunishment = isDefined(directRecord)
    ? type === 'ban'
      ? directRecord.ban
      : directRecord.mute
    : undefined;
  if (isDefined(directPunishment)) {
    if (!Number.isFinite(directPunishment.expires) || directPunishment.expires <= 0) {
      directPunishment.expires = Infinity;
    }
    if (
      typeof directPunishment.expires === 'number' &&
      Number.isFinite(directPunishment.expires) &&
      Date.now() > directPunishment.expires
    ) {
      debugLog(`[PunishmentManager] ${type} for player ${playerId} has expired. Removing.`);
      removePunishmentFromKey(playerId, type);
    } else {
      return directPunishment;
    }
  }

  if (punishments.size === 0) {
    return undefined;
  }

  const targetKeys = resolvePunishmentTargetKeys(playerId);
  const matchedKey = [...targetKeys].find((key) => {
    const record = punishments.get(key);
    return isDefined(record) && isDefined(type === 'ban' ? record.ban : record.mute);
  });

  if (!isDefined(matchedKey)) {
    return undefined;
  }

  const record = punishments.get(matchedKey);
  if (!isDefined(record)) {
    return undefined;
  }

  const punishment = type === 'ban' ? record.ban : record.mute;
  if (!isDefined(punishment)) {
    return undefined;
  }

  if (!Number.isFinite(punishment.expires) || punishment.expires <= 0) {
    punishment.expires = Infinity;
  }

  if (
    typeof punishment.expires === 'number' &&
    Number.isFinite(punishment.expires) &&
    Date.now() > punishment.expires
  ) {
    debugLog(`[PunishmentManager] ${type} for player ${playerId} (key: ${matchedKey}) has expired. Removing.`);
    removePunishmentFromKey(matchedKey, type);
    // If matchedKey expired, re-check candidate keys for any other active punishment record
    for (const key of targetKeys) {
      if (key !== matchedKey && punishments.has(key)) {
        const altRecord = getPunishment(key, type);
        if (isDefined(altRecord)) {
          return altRecord;
        }
      }
    }
    return undefined;
  }

  return punishment;
}

/**
 * Checks if a player is banned and kicks them if so.
 *
 * @param {mc.Player} player The player to check.
 * @returns {boolean} True if the player was kicked (is banned), false otherwise.
 */
export function checkAndKickBannedPlayer(player: mc.Player): boolean {
  clearExpiredPunishments();
  const punishment = getPunishment(player.id, 'ban') ?? getPunishment(player.name.toLowerCase(), 'ban');
  if (isDefined(punishment)) {
    const banReason = isNonEmptyString(punishment.reason) ? punishment.reason : 'You are banned.';
    // Use a slight delay to ensure the kick command processes after join
    mc.system.runTimeout(() => {
      kickPlayer(player.name, banReason);
    }, 5);
    return true;
  }
  return false;
}

/**
 * Removes a punishment for a player by ID or name, purging entity ID, resolved username, and legacy name-keyed entries
 * (including case-variant keys).
 *
 * @param playerId The ID or username of the player to unpunish.
 * @param type The type of punishment to remove.
 */
export function removePunishment(playerId: string, type: PunishmentType): void {
  if (punishments.size === 0) {
    return;
  }

  const targetKeys = resolvePunishmentTargetKeys(playerId);
  let anyChanged = false;

  for (const key of targetKeys) {
    if (removePunishmentFromKey(key, type, false)) {
      anyChanged = true;
    }
  }

  // Also purge case-variant legacy keys (e.g., "AlIcE" vs "Alice") matching candidate names
  const lowerTargetKeys = new Set([...targetKeys].map((k) => k.toLowerCase()));
  for (const key of [...punishments.keys()]) {
    if (lowerTargetKeys.has(key.toLowerCase()) && !targetKeys.has(key)) {
      if (removePunishmentFromKey(key, type, false)) {
        anyChanged = true;
      }
    }
  }

  if (anyChanged) {
    savePunishments();
    debugLog(`[PunishmentManager] Removed ${type} for player ${playerId}.`);
  }
}

/**
 * Lists all active punishments of a given type ('ban' or 'mute').
 *
 * @param type The type of punishment to query ('ban' or 'mute').
 * @returns Array of active punishment records with their associated player identifiers.
 */
export function getActivePunishmentsByType(type: PunishmentType): { playerId: string; punishment: Punishment }[] {
  clearExpiredPunishments();
  const list: { playerId: string; punishment: Punishment }[] = [];
  for (const [playerId, record] of punishments.entries()) {
    const entry = type === 'ban' ? record.ban : record.mute;
    if (isDefined(entry)) {
      if (!Number.isFinite(entry.expires) || entry.expires <= 0) {
        entry.expires = Infinity;
      }
      list.push({ playerId, punishment: entry });
    }
  }
  return list;
}

/** Validates self-targeting and rank hierarchy for moderation actions. */
export function validateModerationTarget(
  executor: CommandExecutor,
  targetId: string,
  actionVerb: string,
  playErrorSoundOnFail = false,
): boolean {
  if (executor instanceof mc.Player && executor.id === targetId) {
    sendMessage(`§cYou cannot ${actionVerb} yourself.`, executor);
    if (playErrorSoundOnFail) {
      playSound(executor, soundError);
    }
    return false;
  }

  if (!canTarget(executor, targetId)) {
    sendMessage(`§cYou cannot ${actionVerb} a player with the same or higher rank than you.`, executor);
    if (playErrorSoundOnFail && executor instanceof mc.Player) {
      playSound(executor, soundError);
    }
    return false;
  }

  return true;
}

/** Initializes the punishment manager's periodic tasks. */
export function initializePunishmentManager() {
  registerDataSaver(savePunishments);
  // Proactively clear expired punishments on startup
  clearExpiredPunishments();
  savePunishments();

  // Periodically clear expired punishments and save to the world
  const config = getConfig();
  setTrackedInterval(
    () => {
      clearExpiredPunishments();
      savePunishments();
    },
    Math.max(20, config.data.autoSaveIntervalSeconds * 20),
  );
}
