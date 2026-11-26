import { getConfig } from '@core/config/configManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { getPlayer, loadPlayerData, setPlayerRanks, updatePlayerData } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';

/** Persisted temporary rank grant record. */
export interface TempRankRecord {
  playerId: string;
  rankId: string;
  expiresAt: number;
}

const storage = new StorageManager('exe:tempRanks:v1');
let tempRanks = new Map<string, TempRankRecord>();
let expiryIntervalId: number | undefined;

/**
 * Parses a compact duration string (e.g. `30m`, `2h`, `7d`) into milliseconds.
 *
 * @param input Duration string.
 * @returns Milliseconds, or undefined if invalid.
 */
export function parseTempRankDuration(input: string): number | undefined {
  const match = /^(\d+)\s*([smhd])$/i.exec(input.trim());
  if (!match) {
    return undefined;
  }
  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * mult;
}

function saveTempRanks(): boolean {
  try {
    return storage.save([...tempRanks.entries()]);
  } catch (err) {
    errorLog(`[TempRank] Failed to save temporary ranks: ${String(err)}`);
    return false;
  }
}

/**
 * Grants a temporary rank to `playerId`, expiring after `durationMs`.
 *
 * @param playerId Target player ID.
 * @param rankId Rank identifier.
 * @param durationMs Duration in milliseconds.
 * @returns True if saved successfully.
 */
export function grantTempRank(playerId: string, rankId: string, durationMs: number): boolean {
  const key = `${playerId}:${rankId}`;
  const pData = getPlayer(playerId) ?? loadPlayerData(playerId);
  const previousRanks = pData?.ranks ? [...pData.ranks] : [getConfig().playerDefaults.rankId];
  const priorTemp = tempRanks.get(key);
  if (previousRanks.includes(rankId) && !priorTemp) {
    return false;
  }

  const nextRanks = previousRanks.includes(rankId) ? previousRanks : [...previousRanks, rankId];
  if (!previousRanks.includes(rankId)) {
    setPlayerRanks(playerId, nextRanks);
  }
  tempRanks.set(key, { playerId, rankId, expiresAt: Date.now() + durationMs });
  if (!saveTempRanks()) {
    if (priorTemp) {
      tempRanks.set(key, priorTemp);
    } else {
      tempRanks.delete(key);
    }
    if (!previousRanks.includes(rankId)) {
      setPlayerRanks(playerId, previousRanks);
    }
    return false;
  }
  return true;
}

/**
 * Removes any tracked temporary rank expiry entry for `playerId` and `rankId` without modifying stored player ranks.
 *
 * @param playerId Target player ID.
 * @param rankId Rank identifier.
 * @returns True if a temporary rank entry was removed.
 */
export function clearTempRank(playerId: string, rankId: string): boolean {
  const key = `${playerId}:${rankId}`;
  const existing = tempRanks.get(key);
  if (!isDefined(existing)) {
    return false;
  }
  tempRanks.delete(key);
  if (!saveTempRanks()) {
    tempRanks.set(key, existing);
    return false;
  }
  return true;
}

/** Checks and revokes any expired temporary ranks. */
export function pruneExpiredTempRanks(): void {
  const now = Date.now();
  let changed = false;
  for (const [key, rec] of tempRanks) {
    if (now >= rec.expiresAt) {
      const pData = getPlayer(rec.playerId);
      if (pData?.ranks) {
        tempRanks.delete(key);
        changed = true;
        const nextRanks = pData.ranks.filter((r) => r !== rec.rankId);
        setPlayerRanks(rec.playerId, nextRanks.length > 0 ? nextRanks : [getConfig().playerDefaults.rankId]);
        const online = pData.name ? findPlayerByName(pData.name) : undefined;
        if (isDefined(online) && online.isValid) {
          updatePlayerNameTag(online, getConfig());
          online.sendMessage(`§eYour temporary rank §b${rec.rankId}§e has expired.`);
        }
      } else {
        let updated = false;
        updatePlayerData(rec.playerId, (offlineData) => {
          updated = true;
          const nextRanks = (offlineData.ranks ?? []).filter((r) => r !== rec.rankId);
          offlineData.ranks = nextRanks.length > 0 ? nextRanks : [getConfig().playerDefaults.rankId];
        });
        if (updated) {
          tempRanks.delete(key);
          changed = true;
        }
      }
    }
  }
  if (changed) {
    saveTempRanks();
  }
}

/** Loads persisted temporary ranks and starts periodic expiry checks. */
export function initializeTempRanks(): void {
  try {
    const loaded = storage.load<[string, TempRankRecord][]>();
    tempRanks = loaded ? new Map(loaded) : new Map();
    debugLog(`[TempRank] Loaded ${tempRanks.size} temporary rank(s).`);
  } catch (err) {
    errorLog(`[TempRank] Failed to load temporary ranks: ${String(err)}`);
    tempRanks = new Map();
  }
  if (expiryIntervalId !== undefined) {
    clearTrackedInterval(expiryIntervalId);
  }
  expiryIntervalId = setTrackedInterval(pruneExpiredTempRanks, 600);
}
