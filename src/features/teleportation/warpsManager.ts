import * as mc from '@minecraft/server';

import { HomeLocation } from '@core/playerDataManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';

const WARPS_PROPERTY_ID = 'exe:warps';
const storage = new StorageManager(WARPS_PROPERTY_ID);

interface ActionResult {
    success: boolean;
    message: string;
}

/**
 * Gets all warps from dynamic properties.
 * @returns A record of warp names to their locations.
 */
function getWarps(): Record<string, HomeLocation> {
    const warps = storage.load<Record<string, HomeLocation>>();
    return warps || {};
}

/**
 * Saves all warps to dynamic properties.
 * @param warps The record of warps to save.
 */
function saveWarps(warps: Record<string, HomeLocation>) {
    storage.save(warps);
}

/**
 * Sets a warp at a specific location.
 * @param warpName The name of the warp.
 * @param location The location of the warp.
 * @param dimensionId The dimension of the warp.
 * @returns The result of the operation.
 */
export function setWarp(warpName: string, location: mc.Vector3, dimensionId: string): ActionResult {
    const warps = getWarps();
    const lowerCaseWarpName = warpName.toLowerCase();

    if (warps[lowerCaseWarpName]) {
        return { success: false, message: `A warp named '${warpName}' already exists.` };
    }
    if (warpName.length > 20) {
        return { success: false, message: 'Warp name cannot be longer than 20 characters.' };
    }

    warps[lowerCaseWarpName] = {
        x: Math.round(location.x * 100) / 100,
        y: Math.round(location.y * 100) / 100,
        z: Math.round(location.z * 100) / 100,
        dimensionId: dimensionId
    };

    saveWarps(warps);
    return { success: true, message: `Warp '${warpName}' has been set.` };
}

/**
 * Gets a warp's location.
 * @param warpName The name of the warp.
 * @returns The location of the warp, or undefined if it doesn't exist.
 */
export function getWarp(warpName: string): HomeLocation | undefined {
    const warps = getWarps();
    return warps[warpName.toLowerCase()] || undefined;
}

/**
 * Deletes a warp.
 * @param warpName The name of the warp.
 * @returns The result of the operation.
 */
export function deleteWarp(warpName: string): ActionResult {
    const warps = getWarps();
    const lowerCaseWarpName = warpName.toLowerCase();

    if (!warps[lowerCaseWarpName]) {
        return { success: false, message: `Warp '${warpName}' does not exist.` };
    }

    delete warps[lowerCaseWarpName];
    saveWarps(warps);
    return { success: true, message: `Warp '${warpName}' has been deleted.` };
}

/**
 * Lists all warps.
 * @returns An array of warp names.
 */
export function listWarps(): string[] {
    const warps = getWarps();
    return Object.keys(warps);
}
