import { getRanksConfig, saveRanksConfig } from './configurations.js';
import { RankDefinition } from './ranksConfig.js';

/**
 * Gets all ranks from the config.
 */
export function getRanks(): RankDefinition[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getRanksConfig() as any).rankDefinitions;
}

/**
 * Gets a single rank by its ID.
 * @param rankId The ID of the rank to find.
 */
export function getRankById(rankId: string): RankDefinition | undefined {
    return getRanks().find(r => r.id === rankId);
}

/**
 * Adds a new rank to the database.
 * @param rankData
 */
export function addRank(rankData: RankDefinition): { success: boolean, message: string } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ranksConfig: any = getRanksConfig();
    if (getRankById(rankData.id)) {
        return { success: false, message: `Rank with ID '${rankData.id}' already exists.` };
    }
    ranksConfig.rankDefinitions.push(rankData);
    saveRanksConfig();
    return { success: true, message: `Rank '${rankData.name}' added successfully.` };
}

/**
 * Updates an existing rank.
 * @param rankId The ID of the rank to update.
 * @param updatedData
 */
export function updateRank(rankId: string, updatedData: Partial<RankDefinition>): { success: boolean, message: string } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ranksConfig: any = getRanksConfig();
    const rankIndex = ranksConfig.rankDefinitions.findIndex((r: RankDefinition) => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    const originalRank = ranksConfig.rankDefinitions[rankIndex];
    if (originalRank.locked) {
        if (updatedData.id && updatedData.id !== originalRank.id) {
            return { success: false, message: 'Cannot change the ID of a locked rank.' };
        }
        if (updatedData.permissionLevel && updatedData.permissionLevel !== originalRank.permissionLevel) {
            return { success: false, message: 'Cannot change the permission level of a locked rank.' };
        }
    }

    // Ensure the ID is not changed if a new ID is passed in updatedData that already exists
    if (updatedData.id && updatedData.id !== rankId && getRankById(updatedData.id)) {
        return { success: false, message: `Cannot rename rank ID to '${updatedData.id}' as it already exists.` };
    }

    let message = `Rank '${updatedData.name || originalRank.name}' updated successfully.`;

    // Add a warning if the rank ID (tag) is changed.
    if (updatedData.id && updatedData.id !== rankId) {
        message += `\n§eWARNING:§r The rank ID (tag) was changed from '${rankId}' to '${updatedData.id}'. Players with the old rank tag will need to be updated manually.`;
    }

    ranksConfig.rankDefinitions[rankIndex] = { ...ranksConfig.rankDefinitions[rankIndex], ...updatedData };
    saveRanksConfig();
    return { success: true, message };
}

/**
 * Deletes a rank from the database.
 * @param rankId The ID of the rank to delete.
 */
export function deleteRank(rankId: string): { success: boolean, message: string } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ranksConfig: any = getRanksConfig();
    const rankIndex = ranksConfig.rankDefinitions.findIndex((r: RankDefinition) => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    const rank = ranksConfig.rankDefinitions[rankIndex];
    if (rank.locked) {
        return { success: false, message: `Cannot delete locked rank '${rank.name}'.` };
    }

    const deletedRankName = ranksConfig.rankDefinitions[rankIndex].name;
    ranksConfig.rankDefinitions.splice(rankIndex, 1);
    saveRanksConfig();
    return { success: true, message: `Rank '${deletedRankName}' deleted successfully.` };
}
