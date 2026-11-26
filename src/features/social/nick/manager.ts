import { getConfig } from '@core/config/configManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { debugLog } from '@core/utils/logger.js';
import * as mc from '@minecraft/server';

const storage = new StorageManager('exe:playerNicks:v1');
let nicks = new Map<string, string>();

/** Loads persisted player nicknames from dynamic properties. */
export function loadNicknames(): void {
  const loaded = storage.load<[string, string][]>();
  nicks = loaded ? new Map(loaded) : new Map();
  debugLog(`[Nick] Loaded ${nicks.size} player nicknames.`);
}

function saveNicknames(): boolean {
  return storage.save([...nicks.entries()]);
}

/**
 * Returns a player's custom nickname if `/nick` is enabled and one is set.
 *
 * @param playerId Player identifier.
 * @returns Custom nickname or undefined.
 */
export function getPlayerNickname(playerId: string): string | undefined {
  if (!getConfig().nick?.enabled) {
    return undefined;
  }
  return nicks.get(playerId);
}

/**
 * Returns the display name to show in chat (nickname if set, otherwise player.name).
 *
 * @param player Target player.
 * @returns Display name string.
 */
export function getDisplayPlayerName(player: mc.Player): string {
  return getPlayerNickname(player.id) ?? player.name;
}

function stripAllColors(text: string): string {
  let current = text;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = stripColorCodes(current);
  }
  return current;
}

/**
 * Sets or clears a player's nickname.
 *
 * @param player Target player.
 * @param rawNick New nickname, or `reset`/`off` to clear.
 * @returns Result with success flag and message.
 */
export function setPlayerNickname(
  player: mc.Player,
  rawNick: string | undefined,
): { success: boolean; message: string } {
  const cfg = getConfig().nick;
  if (!cfg?.enabled) {
    return { success: false, message: '§cNicknames (/nick) are currently disabled.' };
  }
  const previousNick = nicks.get(player.id);
  if (!rawNick || rawNick.toLowerCase() === 'reset' || rawNick.toLowerCase() === 'off') {
    nicks.delete(player.id);
    if (!saveNicknames()) {
      if (previousNick !== undefined) {
        nicks.set(player.id, previousNick);
      }
      return { success: false, message: '§cFailed to save nickname reset.' };
    }
    return { success: true, message: '§aYour nickname has been reset.' };
  }

  const trimmed = rawNick.trim();
  const sanitized = cfg.allowColors ? trimmed : stripAllColors(trimmed);
  const plainLen = stripAllColors(sanitized).length;
  const maxLen = Math.max(3, Math.min(32, Number(cfg.maxLength ?? 20)));

  if (plainLen < 2 || plainLen > maxLen) {
    return { success: false, message: `§cNickname must be between 2 and ${maxLen} characters.` };
  }

  nicks.set(player.id, sanitized);
  if (!saveNicknames()) {
    if (previousNick !== undefined) {
      nicks.set(player.id, previousNick);
    } else {
      nicks.delete(player.id);
    }
    return { success: false, message: '§cFailed to save nickname.' };
  }
  return { success: true, message: `§aNickname set to §f${sanitized}§a!` };
}

/** Clears in-memory nicknames (for tests). */
export function _clearNicknamesForTest(): void {
  nicks.clear();
}
