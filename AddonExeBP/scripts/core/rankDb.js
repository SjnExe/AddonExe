import { world } from '@minecraft/server';
import { rankDefinitions as defaultRanks } from './ranksConfig.js';
import { debugLog, errorLog } from './logger.js';

const RANKS_DB_KEY = 'exe:rankDefinitions';

/** @type {import('./ranksConfig.js').RankDefinition[]} */
let ranksCache = [];
let isLoaded = false;

/**
 * Saves the current ranks cache to world dynamic properties.
 */
export function saveRanks() {
    try {
        world.setDynamicProperty(RANKS_DB_KEY, JSON.stringify(ranksCache));
        debugLog('[RankDB] Saved ranks to dynamic properties.');
    } catch (e) {
        errorLog(`[RankDB] Failed to save ranks: ${e.stack}`);
    }
}

/**
 * Loads ranks from dynamic properties or initializes with defaults.
 * @returns {import('./ranksConfig.js').RankDefinition[]}
 */
export function loadRanks() {
    if (isLoaded) {
        return ranksCache;
    }

    try {
        const dataString = world.getDynamicProperty(RANKS_DB_KEY);
        if (dataString && typeof dataString === 'string') {
            ranksCache = JSON.parse(dataString);
            isLoaded = true;
            debugLog(`[RankDB] Loaded ${ranksCache.length} ranks from dynamic properties.`);
            return ranksCache;
        }
    } catch (e) {
        errorLog(`[RankDB] Failed to load ranks from dynamic properties: ${e.stack}. Initializing with defaults.`);
    }

    // If loading fails or no data exists, load defaults and save.
    debugLog('[RankDB] No ranks found in storage. Initializing with default ranks.');
    ranksCache = [...defaultRanks];
    isLoaded = true;
    saveRanks();
    return ranksCache;
}

/**
 * Gets all ranks from the cache.
 * @returns {import('./ranksConfig.js').RankDefinition[]}
 */
export function getRanks() {
    if (!isLoaded) loadRanks();
    return [...ranksCache];
}

/**
 * Gets a single rank by its ID.
 * @param {string} rankId The ID of the rank to find.
 * @returns {import('./ranksConfig.js').RankDefinition | undefined}
 */
export function getRankById(rankId) {
    if (!isLoaded) loadRanks();
    return ranksCache.find(r => r.id === rankId);
}

/**
 * Adds a new rank to the database.
 * @param {import('./ranksConfig.js').RankDefinition} rankData
 * @returns {{success: boolean, message: string}}
 */
export function addRank(rankData) {
    if (!isLoaded) loadRanks();
    if (getRankById(rankData.id)) {
        return { success: false, message: `Rank with ID '${rankData.id}' already exists.` };
    }
    ranksCache.push(rankData);
    saveRanks();
    return { success: true, message: `Rank '${rankData.name}' added successfully.` };
}

/**
 * Updates an existing rank.
 * @param {string} rankId The ID of the rank to update.
 * @param {Partial<import('./ranksConfig.js').RankDefinition>} updatedData
 * @returns {{success: boolean, message: string}}
 */
export function updateRank(rankId, updatedData) {
    if (!isLoaded) loadRanks();
    const rankIndex = ranksCache.findIndex(r => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    // Ensure the ID is not changed if a new ID is passed in updatedData that already exists
    if (updatedData.id && updatedData.id !== rankId && getRankById(updatedData.id)) {
        return { success: false, message: `Cannot rename rank ID to '${updatedData.id}' as it already exists.` };
    }

    ranksCache[rankIndex] = { ...ranksCache[rankIndex], ...updatedData };
    saveRanks();
    return { success: true, message: `Rank '${ranksCache[rankIndex].name}' updated successfully.` };
}

/**
 * Deletes a rank from the database.
 * @param {string} rankId The ID of the rank to delete.
 * @returns {{success: boolean, message: string}}
 */
export function deleteRank(rankId) {
    if (!isLoaded) loadRanks();
    const rankIndex = ranksCache.findIndex(r => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    // Prevent deletion of special ranks
    const rank = ranksCache[rankIndex];
    if (rank.conditions.some(c => c.type === 'isOwner' || c.type === 'default')) {
        return { success: false, message: `Cannot delete special rank '${rank.name}'.` };
    }

    const deletedRankName = ranksCache[rankIndex].name;
    ranksCache.splice(rankIndex, 1);
    saveRanks();
    return { success: true, message: `Rank '${deletedRankName}' deleted successfully.` };
}
