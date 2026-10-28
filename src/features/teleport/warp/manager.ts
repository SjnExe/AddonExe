import { HomeLocation } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const warpsPropertyId = 'exe:warps';
const storage = new StorageManager(warpsPropertyId);

interface ActionResult {
  success: boolean;
  message: string;
}

let warpsCache: Record<string, HomeLocation> | undefined;

export function invalidateWarpsCache(): void {
  warpsCache = undefined;
}

/**
 * Gets all warps from memory cache or dynamic properties.
 *
 * @returns A record of warp names to their locations.
 */
function getWarps(): Record<string, HomeLocation> {
  if (!isDefined(warpsCache)) {
    warpsCache = storage.load<Record<string, HomeLocation>>() ?? {};
  }
  return warpsCache;
}

/**
 * Saves all warps to dynamic properties and updates the cache.
 *
 * @param warps The record of warps to save.
 */
function saveWarps(warps: Record<string, HomeLocation>) {
  warpsCache = warps;
  storage.save(warps);
}

/**
 * Sets a warp at a specific location.
 *
 * @param warpName The name of the warp.
 * @param location The location of the warp.
 * @param dimensionId The dimension of the warp.
 * @returns The result of the operation.
 */
export function setWarp(
  warpName: string,
  location: mc.Vector3,
  dimensionId: string,
  allowOverwrite = false,
): ActionResult {
  const cleanName = warpName.trim();
  if (cleanName.length === 0 || cleanName.length > 20) {
    return { success: false, message: 'Warp name must be between 1 and 20 characters.' };
  }

  const warps = getWarps();
  const lowerCaseWarpName = cleanName.toLowerCase();
  const isUpdating = isDefined(warps[lowerCaseWarpName]);

  if (isUpdating && !allowOverwrite) {
    return { success: false, message: `A warp named '${cleanName}' already exists.` };
  }

  warps[lowerCaseWarpName] = {
    x: Math.round(location.x * 100) / 100,
    y: Math.round(location.y * 100) / 100,
    z: Math.round(location.z * 100) / 100,
    dimensionId: dimensionId,
  };

  saveWarps(warps);
  return {
    success: true,
    message: isUpdating ? `Warp '${cleanName}' has been updated.` : `Warp '${cleanName}' has been set.`,
  };
}

/**
 * Gets a warp's location.
 *
 * @param warpName The name of the warp.
 * @returns The location of the warp, or undefined if it doesn't exist.
 */
export function getWarp(warpName: string): HomeLocation | undefined {
  const warps = getWarps();
  return warps[warpName.toLowerCase()] || undefined;
}

/**
 * Deletes a warp.
 *
 * @param warpName The name of the warp.
 * @returns The result of the operation.
 */
export function deleteWarp(warpName: string): ActionResult {
  const warps = getWarps();
  const lowerCaseWarpName = warpName.toLowerCase();

  if (!isDefined(warps[lowerCaseWarpName])) {
    return { success: false, message: `Warp '${warpName}' does not exist.` };
  }

  delete warps[lowerCaseWarpName];
  saveWarps(warps);
  return { success: true, message: `Warp '${warpName}' has been deleted.` };
}

/**
 * Lists all warps.
 *
 * @returns An array of warp names.
 */
export function listWarps(): string[] {
  const warps = getWarps();
  return Object.keys(warps);
}
