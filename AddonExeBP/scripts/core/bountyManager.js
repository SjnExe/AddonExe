/**
 * Manages all active player bounties in an efficient, centralized way.
 * @module bountyManager
 */

import { world } from '@minecraft/server';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
import * as playerDataManager from './playerDataManager.js';

const bountyDataKey = 'exe:bountyData';

/**
 * @typedef {object} BountyEntry
 * @property {string} playerId
 * @property {string} name - The last known name of the player with the bounty.
 * @property {number} amount
 */

/**
 * A map of active bounties.
 * Key: playerId, Value: BountyEntry
 * @type {Map<string, BountyEntry>}
 */
let activeBounties = new Map();

/**
 * Loads the active bounty list from a dynamic property into memory.
 */
export function loadBounties() {
    try {
        const dataString = world.getDynamicProperty(bountyDataKey);
        if (dataString && typeof dataString === 'string') {
            /** @type {[string, BountyEntry][]} */
            const parsedData = JSON.parse(dataString);
            activeBounties = new Map(parsedData);
            debugLog(`[BountyManager] Loaded ${activeBounties.size} active bounties.`);
        } else {
            debugLog('[BountyManager] No bounty data found in storage. Starting fresh.');
        }
    } catch (e) {
        errorLog(`[BountyManager] Failed to load bounty data: ${e.stack}`);
        activeBounties = new Map(); // Start with a clean slate on error
    }
}

/**
 * Saves the active bounty list to a dynamic property.
 */
export function saveBounties() {
    try {
        const dataToSave = Array.from(activeBounties.entries());
        world.setDynamicProperty(bountyDataKey, JSON.stringify(dataToSave));
        debugLog('[BountyManager] Saved active bounty data.');
    } catch (e) {
        errorLog(`[BountyManager] Failed to save bounty data: ${e.stack}`);
    }
}

/**
 * Gets the entire map of active bounties.
 * @returns {Map<string, BountyEntry>}
 */
export function getAllBounties() {
    return activeBounties;
}

/**
 * Gets the bounty for a specific player.
 * @param {string} playerId
 * @returns {BountyEntry | undefined}
 */
export function getBounty(playerId) {
    return activeBounties.get(playerId);
}

/**
 * Sets or updates the bounty for a specific player.
 * If the amount is 0 or less, the bounty is removed.
 * @param {string} playerId
 * @param {number} amount
 */
export function setBounty(playerId, amount) {
    if (amount <= 0) {
        removeBounty(playerId);
        return;
    }

    const pData = playerDataManager.getPlayer(playerId);
    if (!pData) {
        errorLog(`[BountyManager] Cannot set bounty for unknown player ID: ${playerId}`);
        return;
    }

    const bountyEntry = {
        playerId: playerId,
        name: pData.name,
        amount: amount
    };

    activeBounties.set(playerId, bountyEntry);
    saveBounties();
    debugLog(`[BountyManager] Set bounty for ${pData.name} to ${amount}.`);
}

/**
 * Adds to an existing bounty.
 * @param {string} playerId
 * @param {number} amountToAdd
 */
export function incrementBounty(playerId, amountToAdd) {
    const existingBounty = activeBounties.get(playerId)?.amount ?? 0;
    setBounty(playerId, existingBounty + amountToAdd);
}


/**
 * Removes a bounty from a player.
 * @param {string} playerId
 */
export function removeBounty(playerId) {
    if (activeBounties.has(playerId)) {
        activeBounties.delete(playerId);
        saveBounties();
        debugLog(`[BountyManager] Removed bounty for player ID ${playerId}.`);
    }
}
