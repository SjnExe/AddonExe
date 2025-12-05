import * as mc from '@minecraft/server';

import { getConfig } from '../../core/configManager.js';
import {
    deletePlayerHome as deletePlayerDataHome,
    getOrCreatePlayer,
    HomeLocation,
    setPlayerHome as setPlayerDataHome
} from '../../core/playerDataManager.js';

interface ActionResult {
    success: boolean;
    message: string;
}

/**
 * Sets a home for a player.
 * @param player The player setting the home.
 * @param homeName The name of the home.
 * @returns The result of the operation.
 */
export function setHome(player: mc.Player, homeName: string): ActionResult {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return { success: false, message: 'Could not find your player data.' };
    }

    const lowerCaseHomeName = homeName.toLowerCase();

    // Prevent overwriting an existing home
    if (pData.homes[lowerCaseHomeName]) {
        return {
            success: false,
            message: `You already have a home named '${homeName}'. Use /delhome to remove it first.`
        };
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

    const location: HomeLocation = {
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
 * @param player The player.
 * @param homeName The name of the home.
 * @returns The location of the home, or null if it doesn't exist.
 */
export function getHome(player: mc.Player, homeName: string): HomeLocation | null {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return null;
    }
    return pData.homes[homeName.toLowerCase()] || null;
}

/**
 * Deletes a player's home.
 * @param player The player.
 * @param homeName The name of the home.
 * @returns The result of the operation.
 */
export function deleteHome(player: mc.Player, homeName: string): ActionResult {
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
 * @param player The player.
 * @returns An array of home names.
 */
export function listHomes(player: mc.Player): string[] {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return [];
    }
    return Object.keys(pData.homes);
}

/**
 * Gets the number of homes a player has set.
 * @param player The player.
 * @returns The number of homes.
 */
export function getHomeCount(player: mc.Player): number {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return 0;
    }
    return Object.keys(pData.homes).length;
}
