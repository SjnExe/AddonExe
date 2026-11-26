import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { kickPlayer } from '@core/utils/player.js';
import * as mc from '@minecraft/server';

/** Persisted server maintenance mode configuration and whitelist. */
export interface MaintenanceState {
  enabled: boolean;
  reason: string;
  whitelist: string[];
}

const storage = new StorageManager('exe:maintenance:v1');
let state: MaintenanceState = {
  enabled: false,
  reason: 'Server is currently under maintenance. Please try again later.',
  whitelist: [],
};

/** Loads maintenance mode state and whitelist from dynamic properties. */
export function loadMaintenanceState(): void {
  try {
    const loaded = storage.load<MaintenanceState>();
    if (loaded) {
      state = {
        enabled: Boolean(loaded.enabled),
        reason: loaded.reason || 'Server is currently under maintenance. Please try again later.',
        whitelist: Array.isArray(loaded.whitelist) ? loaded.whitelist : [],
      };
    }
    debugLog(`[Maintenance] Loaded state: enabled=${state.enabled}, whitelist=${state.whitelist.length}`);
  } catch (err) {
    errorLog(`[Maintenance] Failed to load state: ${String(err)}`);
  }
}

function saveMaintenanceState(): boolean {
  try {
    return storage.save(state);
  } catch (err) {
    errorLog(`[Maintenance] Failed to save state: ${String(err)}`);
    return false;
  }
}

/**
 * Returns a copy of the current maintenance mode state.
 *
 * @returns Current maintenance state snapshot.
 */
export function getMaintenanceState(): MaintenanceState {
  return { ...state, whitelist: [...state.whitelist] };
}

/**
 * Enables or disables maintenance mode with an optional reason.
 *
 * @param enabled Whether maintenance mode is active.
 * @param reason Optional disconnect reason shown to non-whitelisted players.
 * @returns True if state persisted successfully.
 */
export function setMaintenanceEnabled(enabled: boolean, reason?: string): boolean {
  const prev = { ...state, whitelist: [...state.whitelist] };
  state.enabled = enabled;
  if (reason && reason.trim().length > 0) {
    state.reason = reason.trim();
  }
  if (!saveMaintenanceState()) {
    state = prev;
    return false;
  }
  return true;
}

/**
 * Adds a player name to the maintenance whitelist.
 *
 * @param playerName Player username.
 * @returns True if added, false if invalid, already present, or save failed.
 */
export function addMaintenanceWhitelist(playerName: string): boolean {
  const norm = playerName.trim().toLowerCase();
  if (!norm || state.whitelist.includes(norm)) {
    return false;
  }
  state.whitelist.push(norm);
  if (!saveMaintenanceState()) {
    state.whitelist.pop();
    return false;
  }
  return true;
}

/**
 * Removes a player name from the maintenance whitelist.
 *
 * @param playerName Player username.
 * @returns True if removed, false if not present or save failed.
 */
export function removeMaintenanceWhitelist(playerName: string): boolean {
  const norm = playerName.trim().toLowerCase();
  const idx = state.whitelist.indexOf(norm);
  if (idx < 0) {
    return false;
  }
  const removed = state.whitelist.splice(idx, 1)[0]!;
  if (!saveMaintenanceState()) {
    state.whitelist.splice(idx, 0, removed);
    return false;
  }
  return true;
}

/**
 * Checks if a player is permitted to join during maintenance mode.
 *
 * @param player Joining player.
 * @returns True if permitted.
 */
export function isPlayerAllowedInMaintenance(player: mc.Player): boolean {
  if (!state.enabled) {
    return true;
  }
  if (hasPermission(player, 'group.mod') || hasPermission(player, 'bypass.maintenance')) {
    return true;
  }
  return state.whitelist.includes(player.name.toLowerCase());
}

/**
 * Enforces maintenance mode on player join.
 *
 * @param player Joining player.
 * @returns True if the player was kicked.
 */
export function enforceMaintenanceOnJoin(player: mc.Player): boolean {
  if (isPlayerAllowedInMaintenance(player)) {
    return false;
  }
  return kickPlayer(player.name, state.reason);
}

/** Resets maintenance state (for tests). */
export function _resetMaintenanceForTest(): void {
  state = {
    enabled: false,
    reason: 'Server is currently under maintenance. Please try again later.',
    whitelist: [],
  };
}
