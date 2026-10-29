/**
 * Manages all active player bounties in an efficient, centralized way.
 *
 * @module bountyManager
 */

import { getConfig } from '@core/config/configManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { calculateTaxWithPolicy, formatCurrency } from '@core/utils/economy.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { economyMainDefaults } from '@features/economy/config.js';

const bountyDataKey = 'exe:bountyData';
const storage = new StorageManager(bountyDataKey);

interface BountyEntry {
  playerId: string;
  name: string; // The last known name of the player with the bounty.
  amount: number;
}

/** A map of active bounties. Key: playerId, Value: BountyEntry */
let activeBounties = new Map<string, BountyEntry>();

/** Loads the active bounty list from a dynamic property into memory. */
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

/** Saves the active bounty list to a dynamic property. */
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
 *
 * @returns The map of active bounties.
 */
export function getAllBounties(): Map<string, BountyEntry> {
  return activeBounties;
}

/**
 * Gets the bounty for a specific player.
 *
 * @param playerId The ID of the player to check.
 * @returns The bounty entry or undefined.
 */
export function getBounty(playerId: string): BountyEntry | undefined {
  return activeBounties.get(playerId);
}

/**
 * Sets or updates the bounty for a specific player. If the amount is 0 or less, the bounty is removed.
 *
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
    amount: roundedAmount,
  };

  activeBounties.set(playerId, bountyEntry);
  saveBounties();
  debugLog(`[BountyManager] Set bounty for ${pData.name} to ${roundedAmount}.`);
}

/**
 * Adds to an existing bounty.
 *
 * @param playerId The player ID.
 * @param amountToAdd The amount to add.
 */
export function incrementBounty(playerId: string, amountToAdd: number) {
  const existingBounty = activeBounties.get(playerId)?.amount ?? 0;
  setBounty(playerId, existingBounty + amountToAdd);
}

/**
 * Removes a bounty from a player.
 *
 * @param playerId The player ID.
 */
export function removeBounty(playerId: string) {
  if (activeBounties.has(playerId)) {
    activeBounties.delete(playerId);
    saveBounties();
    debugLog(`[BountyManager] Removed bounty for player ID ${playerId}.`);
  }
}

/** Places a bounty on a player, handling money deduction safely. */
export function placeBounty(
  sourcePlayerId: string,
  targetPlayerId: string,
  amount: number,
): { success: boolean; message: string } {
  if (amount <= 0) {
    return { success: false, message: 'Invalid amount.' };
  }

  const pData = playerDataManager.getPlayer(sourcePlayerId);
  if (!pData) {
    return { success: false, message: 'Could not find your data.' };
  }

  let bountyCfg = economyMainDefaults.bounties;
  try {
    bountyCfg = getConfig().bounties ?? economyMainDefaults.bounties;
  } catch {
    bountyCfg = economyMainDefaults.bounties;
  }
  const tax =
    Number(bountyCfg.placementTaxPercentage ?? 0) > 0
      ? calculateTaxWithPolicy(amount, {
          ratePercent: bountyCfg.placementTaxPercentage,
          minTax: bountyCfg.minTax ?? 0,
          maxTax: bountyCfg.maxTax ?? 0,
        }).tax
      : 0;

  const totalCost = Math.round((amount + tax) * 100) / 100;
  if (pData.balance < totalCost) {
    return {
      success: false,
      message:
        tax > 0
          ? `Insufficient funds (requires ${formatCurrency(totalCost)} including ${formatCurrency(tax)} tax).`
          : 'Insufficient funds.',
    };
  }

  // Verify target (offline supported)
  const targetData = playerDataManager.loadPlayerData(targetPlayerId);
  if (!targetData) {
    return { success: false, message: 'Target not found.' };
  }

  // Deduct Money (bounty + placement tax)
  playerDataManager.incrementPlayerBalance(sourcePlayerId, -totalCost);

  // Add Bounty
  incrementBounty(targetPlayerId, amount);

  const taxNote = tax > 0 ? ` (+${formatCurrency(tax)} fee)` : '';
  return { success: true, message: `Placed bounty of $${amount}${taxNote} on ${targetData.name}.` };
}

/** Resets active bounties in-memory cache for unit tests. */
export function _clearBountiesForTest(): void {
  activeBounties.clear();
}
