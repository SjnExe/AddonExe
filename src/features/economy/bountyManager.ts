/**
 * Manages all active player bounties in an efficient, centralized way.
 * @module bountyManager
 */

import { debugLog, errorLog } from '@core/logger.js';
import * as playerDataManager from '@core/playerDataManager.js';
import { StorageManager } from '@core/storage/StorageManager.js';

const bountyDataKey = 'exe:bountyData';
const storage = new StorageManager(bountyDataKey);

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
        const parsedData = storage.load<[string, BountyEntry][]>();
        if (parsedData) {
            activeBounties = new Map(parsedData);
            debugLog(`[BountyManager] Loaded ${activeBounties.size} active bounties.`);
        } else {
            debugLog('[BountyManager] No bounty data found in storage. Starting fresh.');
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[BountyManager] Failed to load bounty data: ${error.stack}`);
        } else {
            errorLog(`[BountyManager] Failed to load bounty data: ${String(error)}`);
        }
        activeBounties = new Map(); // Start with a clean slate on error
    }
}

/**
 * Saves the active bounty list to a dynamic property.
 */
export function saveBounties() {
    try {
        const dataToSave = [...activeBounties.entries()];
        storage.save(dataToSave);
        debugLog('[BountyManager] Saved active bounty data.');
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[BountyManager] Failed to save bounty data: ${error.stack}`);
        } else {
            errorLog(`[BountyManager] Failed to save bounty data: ${String(error)}`);
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

    // Strict 2-decimal precision
    const roundedAmount = Number.parseFloat(amount.toFixed(2));

    const bountyEntry: BountyEntry = {
        playerId: playerId,
        name: pData.name,
        amount: roundedAmount
    };

    activeBounties.set(playerId, bountyEntry);
    saveBounties();
    debugLog(`[BountyManager] Set bounty for ${pData.name} to ${roundedAmount}.`);
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

/**
 * Places a bounty on a player, handling money deduction safely.
 */
export function placeBounty(sourcePlayerId: string, targetPlayerId: string, amount: number): { success: boolean; message: string } {
    if (amount <= 0) return { success: false, message: 'Invalid amount.' };

    const pData = playerDataManager.getPlayer(sourcePlayerId);
    if (!pData) return { success: false, message: 'Could not find your data.' };
    if (pData.balance < amount) return { success: false, message: 'Insufficient funds.' };

    // Verify target (offline supported)
    const targetData = playerDataManager.loadPlayerData(targetPlayerId);
    if (!targetData) return { success: false, message: 'Target not found.' };

    // Deduct Money
    playerDataManager.incrementPlayerBalance(sourcePlayerId, -amount);

    // Add Bounty
    incrementBounty(targetPlayerId, amount);

    return { success: true, message: `Placed bounty of $${amount} on ${targetData.name}.` };
}
