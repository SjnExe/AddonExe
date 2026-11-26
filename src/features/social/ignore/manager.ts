import { getConfig } from '@core/config/configManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { debugLog } from '@core/utils/logger.js';

const storage = new StorageManager('exe:playerIgnores:v1');
let ignoreMap = new Map<string, Set<string>>();

/** Loads persisted player ignore lists from dynamic properties. */
export function loadIgnores(): void {
  const loaded = storage.load<[string, string[]][]>();
  ignoreMap = new Map();
  if (loaded) {
    for (const [ownerId, targets] of loaded) {
      ignoreMap.set(ownerId, new Set(targets));
    }
  }
  debugLog(`[Ignore] Loaded ignore lists for ${ignoreMap.size} players.`);
}

function saveIgnores(): boolean {
  const serialized: [string, string[]][] = [];
  for (const [ownerId, set] of ignoreMap) {
    if (set.size > 0) {
      serialized.push([ownerId, [...set]]);
    }
  }
  return storage.save(serialized);
}

/**
 * Checks whether `ownerId` is currently ignoring `senderId`.
 *
 * @param ownerId Recipient player ID.
 * @param senderId Sender player ID.
 * @returns True if ignored.
 */
export function isPlayerIgnored(ownerId: string, senderId: string): boolean {
  if (!getConfig().ignore?.enabled) {
    return false;
  }
  return ignoreMap.get(ownerId)?.has(senderId) ?? false;
}

/**
 * Toggles ignore status for `targetId` on `ownerId`'s ignore list.
 *
 * @param ownerId Player modifying their ignore list.
 * @param targetId Target player ID.
 * @param targetName Target player name.
 * @returns Updated ignore status and message.
 */
export function toggleIgnorePlayer(
  ownerId: string,
  targetId: string,
  targetName: string,
): { ignored: boolean; message: string } {
  const cfg = getConfig().ignore;
  if (!cfg?.enabled) {
    return { ignored: false, message: '§cThe /ignore command is currently disabled.' };
  }
  if (ownerId === targetId) {
    return { ignored: false, message: '§cYou cannot ignore yourself.' };
  }
  let set = ignoreMap.get(ownerId);
  if (!set) {
    set = new Set();
    ignoreMap.set(ownerId, set);
  }
  if (set.has(targetId)) {
    set.delete(targetId);
    if (!saveIgnores()) {
      set.add(targetId);
      return { ignored: true, message: '§cFailed to save ignore list.' };
    }
    return { ignored: false, message: `§aYou are no longer ignoring §e${targetName}§a.` };
  }
  const maxIgnored = Math.max(1, Number(cfg.maxIgnoredPerPlayer ?? 50));
  if (set.size >= maxIgnored) {
    return { ignored: false, message: `§cYour ignore list is full (max ${maxIgnored}).` };
  }
  set.add(targetId);
  if (!saveIgnores()) {
    set.delete(targetId);
    return { ignored: false, message: '§cFailed to save ignore list.' };
  }
  return { ignored: true, message: `§eYou are now ignoring §f${targetName}§e.` };
}

/**
 * Returns all ignored player IDs for an owner.
 *
 * @param ownerId Owner player ID.
 * @returns Array of ignored player IDs.
 */
export function getIgnoredPlayerIds(ownerId: string): string[] {
  return [...(ignoreMap.get(ownerId) ?? [])];
}

/** Clears in-memory ignore lists (for tests). */
export function _clearIgnoresForTest(): void {
  ignoreMap.clear();
}
