import { StorageManager } from '@core/data/storageManager.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined, isNumber } from '@lib/guards.js';

const cooldownDbKey = 'exe:cooldowns';
const cooldownStorage = new StorageManager(cooldownDbKey);
const saveIntervalTicks = 6000; // Every 5 minutes

/** Map<"playerId:identifier", expiryTimestamp> */
let cooldowns = new Map<string, number>();
let needsSave = false;
let cooldownIntervalId: number | undefined;

/** Loads cooldowns from world dynamic properties. */
export function loadCooldowns() {
  if (isDefined(cooldownIntervalId)) {
    clearTrackedInterval(cooldownIntervalId);
  }
  cooldownIntervalId = setTrackedInterval(() => {
    clearExpiredCooldowns();
    saveCooldowns();
  }, saveIntervalTicks);
  debugLog('[CooldownManager] Loading cooldowns...');
  try {
    const parsedData = cooldownStorage.load<[string, number][]>();
    if (isDefined(parsedData) && Array.isArray(parsedData)) {
      cooldowns = new Map(parsedData);
      debugLog(`[CooldownManager] Loaded ${cooldowns.size} cooldowns.`);
    }
  } catch (error) {
    errorLog('[CooldownManager] Failed to load cooldown data.', error);
    cooldowns = new Map();
  }
}

/** Saves cooldowns to world dynamic properties if a change has occurred. */
export function saveCooldowns(): boolean {
  if (!needsSave) {
    return false;
  }
  try {
    // Convert Map to an array for JSON serialization
    const dataToSave = [...cooldowns.entries()];
    cooldownStorage.save(dataToSave);
    needsSave = false;
    debugLog('[CooldownManager] Saved cooldowns to world properties.');
    return true;
  } catch (error) {
    errorLog('[CooldownManager] Failed to save cooldowns.', error);
    return false;
  }
}

/**
 * Iterates through all cooldowns and removes any that have expired. This is for proactive cleanup to prevent the
 * cooldown map from growing indefinitely.
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
 * Sets a cooldown for a player for a specific identifier.
 *
 * @param playerId
 * @param identifier A unique name for the cooldown (e.g., a command name).
 * @param durationSeconds The length of the cooldown in seconds.
 */
export function setCooldown(playerId: string, identifier: string, durationSeconds: number) {
  if (durationSeconds <= 0) {
    return;
  }
  const key = getCooldownKey(playerId, identifier);
  const cooldownMs = durationSeconds * 1000;
  cooldowns.set(key, Date.now() + cooldownMs);
  needsSave = true;
  // Cooldowns are saved periodically, no need to save immediately unless critical.
}

/**
 * Gets the remaining cooldown for a player for a specific identifier.
 *
 * @param playerId
 * @param identifier A unique name for the cooldown (e.g., a command name).
 * @returns Remaining cooldown in seconds, or 0 if available.
 */
export function getCooldown(playerId: string, identifier: string): number {
  const key = getCooldownKey(playerId, identifier);
  const expiry = cooldowns.get(key);

  if (!isNumber(expiry)) {
    return 0;
  }

  const now = Date.now();
  if (now >= expiry) {
    cooldowns.delete(key);
    needsSave = true;
    return 0;
  }

  return Math.ceil((expiry - now) / 1000);
}

export function _clearCooldownsForTest(): void {
  cooldowns.clear();
  needsSave = false;
}
