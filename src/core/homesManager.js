import { getOrCreatePlayer, setPlayerHome as setPlayerDataHome, deletePlayerHome as deletePlayerDataHome } from './playerDataManager.js';
import { getConfig } from './configManager.js';

/**
 * Sets a home for a player.
 * @param {import('@minecraft/server').Player} player The player setting the home.
 * @param {string} homeName The name of the home.
 * @returns {{success: boolean, message: string}}
 */
export function setHome(player, homeName) {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return { success: false, message: 'Could not find your player data.' };
    }

    const lowerCaseHomeName = homeName.toLowerCase();

    // Prevent overwriting an existing home
    if (pData.homes[lowerCaseHomeName]) {
        return { success: false, message: `You already have a home named '${homeName}'. Use /delhome to remove it first.` };
    }

    const config = getConfig();
    const homeCount = Object.keys(pData.homes).length;

    // Check if the player has reached the maximum number of homes
    if (homeCount >= config.homes.maxHomes) {
        return { success: false, message: `You have reached the maximum number of homes (${config.homes.maxHomes}).` };
    }

    if (homeName.length > 20) {
        return { success: false, message: 'Home name cannot be longer than 20 characters.' };
    }

    const location = {
        x: Math.round(player.location.x * 100) / 100,
        y: Math.round(player.location.y * 100) / 100,
        z: Math.round(player.location.z * 100) / 100,
        dimensionId: player.dimension.id
    };

    setPlayerDataHome(player.id, lowerCaseHomeName, location);
    return { success: true, message: `Home '${homeName}' has been set.` };
}

/**
 * Gets a player's home location.
 * @param {import('@minecraft/server').Player} player The player.
 * @param {string} homeName The name of the home.
 * @returns {import('./playerDataManager.js').HomeLocation | null}
 */
export function getHome(player, homeName) {
    const pData = getOrCreatePlayer(player);
    if (!pData) {return null;}
    return pData.homes[homeName.toLowerCase()] || null;
}

/**
 * Deletes a player's home.
 * @param {import('@minecraft/server').Player} player The player.
 * @param {string} homeName The name of the home.
 * @returns {{success: boolean, message: string}}
 */
export function deleteHome(player, homeName) {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return { success: false, message: 'Could not find your player data.' };
    }

    const lowerCaseHomeName = homeName.toLowerCase();

    if (!pData.homes[lowerCaseHomeName]) {
        return { success: false, message: `Home '${homeName}' does not exist.` };
    }

    deletePlayerDataHome(player.id, lowerCaseHomeName);
    return { success: true, message: `Home '${homeName}' has been deleted.` };
}

/**
 * Lists all of a player's homes.
 * @param {import('@minecraft/server').Player} player The player.
 * @returns {string[]} An array of home names.
 */
export function listHomes(player) {
    const pData = getOrCreatePlayer(player);
    if (!pData) {return [];}
    return Object.keys(pData.homes);
}

/**
 * Gets the number of homes a player has set.
 * @param {import('@minecraft/server').Player} player The player.
 * @returns {number}
 */
export function getHomeCount(player) {
    const pData = getOrCreatePlayer(player);
    if (!pData) {return 0;}
    return Object.keys(pData.homes).length;
}
