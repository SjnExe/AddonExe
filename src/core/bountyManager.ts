/**
 * Manages all active player bounties in an efficient, centralized way.
 * @module bountyManager
 */

import * as mc from '@minecraft/server';
import { debugLog } from './logger.js';
import { errorLog } from './logger.js';
import * as playerDataManager from './playerDataManager.js';

const bountyDataKey = 'exe:bountyData';

interface BountyEntry {
    playerId: string;
    name: string; // The last known name of the player with the bounty.
    amount: number;
}

/**
 * A map of active bounties.
 * Key: playerId, Value: BountyEntry
 */
let activeBounties = new Map<string, BountyEntry>();

/**
 * Loads the active bounty list from a dynamic property into memory.
 */
export function loadBounties() {
    try {
        const dataString = mc.world.getDynamicProperty(bountyDataKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData: [string, BountyEntry][] = JSON.parse(dataString);
            activeBounties = new Map(parsedData);
            debugLog(`[BountyManager] Loaded ${activeBounties.size} active bounties.`);
        } else {
            debugLog('[BountyManager] No bounty data found in storage. Starting fresh.');
        }
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[BountyManager] Failed to load bounty data: ${e.stack}`);
        } else {
            errorLog(`[BountyManager] Failed to load bounty data: ${String(e)}`);
        }
        activeBounties = new Map(); // Start with a clean slate on error
    }
}

/**
 * Saves the active bounty list to a dynamic property.
 */
export function saveBounties() {
    try {
        const dataToSave = Array.from(activeBounties.entries());
        mc.world.setDynamicProperty(bountyDataKey, JSON.stringify(dataToSave));
        debugLog('[BountyManager] Saved active bounty data.');
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[BountyManager] Failed to save bounty data: ${e.stack}`);
        } else {
            errorLog(`[BountyManager] Failed to save bounty data: ${String(e)}`);
        }
    }
}

/**
 * Gets the entire map of active bounties.
 * @returns The map of active bounties.
 */
export function getAllBounties(): Map<string, BountyEntry> {
    return activeBounties;
}

/**
 * Gets the bounty for a specific player.
 * @param playerId The ID of the player to check.
 * @returns The bounty entry or undefined.
 */
export function getBounty(playerId: string): BountyEntry | undefined {
    return activeBounties.get(playerId);
}

/**
 * Sets or updates the bounty for a specific player.
 * If the amount is 0 or less, the bounty is removed.
 * @param playerId The player ID.
 * @param amount The bounty amount.
 */
export function setBounty(playerId: string, amount: number) {
    if (amount <= 0) {
        removeBounty(playerId);
        return;
    }

    const pData = playerDataManager.loadPlayerData(playerId);
    if (!pData) {
        errorLog(`[BountyManager] Cannot set bounty for unknown player ID: ${playerId}`);
        return;
    }

    const bountyEntry: BountyEntry = {
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
 * @param playerId The player ID.
 * @param amountToAdd The amount to add.
 */
export function incrementBounty(playerId: string, amountToAdd: number) {
    const existingBounty = activeBounties.get(playerId)?.amount ?? 0;
    setBounty(playerId, existingBounty + amountToAdd);
}


/**
 * Removes a bounty from a player.
 * @param playerId The player ID.
 */
export function removeBounty(playerId: string) {
    if (activeBounties.has(playerId)) {
        activeBounties.delete(playerId);
        saveBounties();
        debugLog(`[BountyManager] Removed bounty for player ID ${playerId}.`);
    }
}
