import { getRanksConfig, saveRanksConfig } from './configurations.js';

/**
 * Gets all ranks from the config.
 * @returns {import('./ranksConfig.js').RankDefinition[]}
 */
export function getRanks() {
    return getRanksConfig().rankDefinitions;
}

/**
 * Gets a single rank by its ID.
 * @param {string} rankId The ID of the rank to find.
 * @returns {import('./ranksConfig.js').RankDefinition | undefined}
 */
export function getRankById(rankId) {
    return getRanks().find(r => r.id === rankId);
}

/**
 * Adds a new rank to the database.
 * @param {import('./ranksConfig.js').RankDefinition} rankData
 * @returns {{success: boolean, message: string}}
 */
export function addRank(rankData) {
    const ranksConfig = getRanksConfig();
    if (getRankById(rankData.id)) {
        return { success: false, message: `Rank with ID '${rankData.id}' already exists.` };
    }
    ranksConfig.rankDefinitions.push(rankData);
    saveRanksConfig();
    return { success: true, message: `Rank '${rankData.name}' added successfully.` };
}

/**
 * Updates an existing rank.
 * @param {string} rankId The ID of the rank to update.
 * @param {Partial<import('./ranksConfig.js').RankDefinition>} updatedData
 * @returns {{success: boolean, message: string}}
 */
export function updateRank(rankId, updatedData) {
    const ranksConfig = getRanksConfig();
    const rankIndex = ranksConfig.rankDefinitions.findIndex(r => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    // Ensure the ID is not changed if a new ID is passed in updatedData that already exists
    if (updatedData.id && updatedData.id !== rankId && getRankById(updatedData.id)) {
        return { success: false, message: `Cannot rename rank ID to '${updatedData.id}' as it already exists.` };
    }

    ranksConfig.rankDefinitions[rankIndex] = { ...ranksConfig.rankDefinitions[rankIndex], ...updatedData };
    saveRanksConfig();
    return { success: true, message: `Rank '${ranksConfig.rankDefinitions[rankIndex].name}' updated successfully.` };
}

/**
 * Deletes a rank from the database.
 * @param {string} rankId The ID of the rank to delete.
 * @returns {{success: boolean, message: string}}
 */
export function deleteRank(rankId) {
    const ranksConfig = getRanksConfig();
    const rankIndex = ranksConfig.rankDefinitions.findIndex(r => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    // Prevent deletion of special ranks
    const rank = ranksConfig.rankDefinitions[rankIndex];
    if (rank.conditions.some(c => c.type === 'isOwner' || c.type === 'default')) {
        return { success: false, message: `Cannot delete special rank '${rank.name}'.` };
    }

    const deletedRankName = ranksConfig.rankDefinitions[rankIndex].name;
    ranksConfig.rankDefinitions.splice(rankIndex, 1);
    saveRanksConfig();
    return { success: true, message: `Rank '${deletedRankName}' deleted successfully.` };
}
