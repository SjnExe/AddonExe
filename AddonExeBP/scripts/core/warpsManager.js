import { world } from '@minecraft/server';

const WARPS_PROPERTY_ID = 'exe:warps';

/**
 * Gets all warps from dynamic properties.
 * @returns {Record<string, import('./playerDataManager.js').HomeLocation>}
 */
function getWarps() {
    const warpsJson = world.getDynamicProperty(WARPS_PROPERTY_ID);
    return warpsJson ? JSON.parse(warpsJson) : {};
}

/**
 * Saves all warps to dynamic properties.
 * @param {Record<string, any>} warps
 */
function saveWarps(warps) {
    world.setDynamicProperty(WARPS_PROPERTY_ID, JSON.stringify(warps));
}

/**
 * Sets a warp at a specific location.
 * @param {string} warpName The name of the warp.
 * @param {import('@minecraft/server').Location} location The location of the warp.
 * @param {string} dimensionId The dimension of the warp.
 * @returns {{success: boolean, message: string}}
 */
export function setWarp(warpName, location, dimensionId) {
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
 * @param {string} warpName The name of the warp.
 * @returns {import('./playerDataManager.js').HomeLocation | null}
 */
export function getWarp(warpName) {
    const warps = getWarps();
    return warps[warpName.toLowerCase()] || null;
}

/**
 * Deletes a warp.
 * @param {string} warpName The name of the warp.
 * @returns {{success: boolean, message: string}}
 */
export function deleteWarp(warpName) {
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
 * @returns {string[]} An array of warp names.
 */
export function listWarps() {
    const warps = getWarps();
    return Object.keys(warps);
}