import { getRanksConfig, saveRanksConfig } from '@core/configurations.js';
import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

const rankIndexCache = new Map<string, number>();

function getRankIndex(ranks: RankDefinition[], rankId: string): number {
    const index = rankIndexCache.get(rankId);
    if (index !== undefined && ranks[index]?.id === rankId) {
        return index;
    }

    rankIndexCache.clear();
    for (let i = 0; i < ranks.length; i++) {
        const rank = ranks[i];
        if (rank) {
            rankIndexCache.set(rank.id, i);
        }
    }

    return rankIndexCache.get(rankId) ?? -1;
}

/**
 * Gets all ranks from the config.
 */
export function getRanks(): RankDefinition[] {
    return getRanksConfig().rankDefinitions;
}

/**
 * Gets a single rank by its ID.
 * @param rankId The ID of the rank to find.
 */
export function getRankById(rankId: string): RankDefinition | undefined {
    const ranks = getRanks();
    const index = getRankIndex(ranks, rankId);
    return index !== -1 ? ranks[index] : undefined;
}

/**
 * Adds a new rank to the database.
 * @param rankData
 */
export function addRank(rankData: RankDefinition): { success: boolean; message: string } {
    const ranksConfig = getRanksConfig();
    if (isDefined(getRankById(rankData.id))) {
        return { success: false, message: `Rank with ID '${rankData.id}' already exists.` };
    }
    ranksConfig.rankDefinitions.push(rankData);
    rankIndexCache.clear();
    saveRanksConfig(ranksConfig);
    return { success: true, message: `Rank '${rankData.name}' added successfully.` };
}

/**
 * Updates an existing rank.
 * @param rankId The ID of the rank to update.
 * @param updatedData
 */
export function updateRank(rankId: string, updatedData: Partial<RankDefinition>): { success: boolean; message: string } {
    const ranksConfig = getRanksConfig();
    const rankIndex = getRankIndex(ranksConfig.rankDefinitions, rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    const originalRank = ranksConfig.rankDefinitions[rankIndex];
    if (!isDefined(originalRank)) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    // Check for critical immutable properties on locked ranks
    if (
        originalRank.locked === true && // We prevent changing the ID of locked ranks to avoid breaking internal references (like code that checks for 'admin' rank)
        isDefined(updatedData.id) &&
        updatedData.id !== originalRank.id
    ) {
        return { success: false, message: 'Cannot change the ID of a locked rank.' };
    }

    // We allow changing Permission Level now, as requested.
    // We allow changing Name, Prefix, etc.

    // Ensure the ID is not changed if a new ID is passed in updatedData that already exists (and isn't the current one)
    if (isDefined(updatedData.id) && updatedData.id !== rankId && isDefined(getRankById(updatedData.id))) {
        return { success: false, message: `Cannot rename rank ID to '${updatedData.id}' as it already exists.` };
    }

    let message = `Rank '${updatedData.name ?? originalRank.name}' updated successfully.`;

    // Add a warning if the rank ID (tag) is changed on a non-locked rank.
    if (isNonEmptyString(updatedData.id) && updatedData.id !== rankId) {
        message += `\n§eWARNING:§r The rank ID (tag) was changed from '${rankId}' to '${updatedData.id}'. Players with the old rank tag will need to be updated manually.`;
    }

    const currentRank = ranksConfig.rankDefinitions[rankIndex];
    if (isDefined(currentRank)) {
        let finalRank = { ...currentRank, ...updatedData };
        if (rankId === 'owner') {
            finalRank = {
                ...finalRank,
                id: currentRank.id,
                priority: currentRank.priority,
                allow: currentRank.allow,
                deny: currentRank.deny,
                groups: currentRank.groups,
                conditions: currentRank.conditions
            };
        } else if (rankId === 'member') {
            finalRank = {
                ...finalRank,
                id: currentRank.id,
                priority: currentRank.priority
            };
        }
        ranksConfig.rankDefinitions[rankIndex] = finalRank;
    }
    saveRanksConfig(ranksConfig);

    // Trigger cache invalidation if permission engine requires it
    import('@core/permissionEngine.js').then((m) => m.invalidateRankCache(rankId)).catch(() => {});

    return { success: true, message };
}

/**
 * Deletes a rank from the database.
 * @param rankId The ID of the rank to delete.
 */
export function deleteRank(rankId: string): { success: boolean; message: string } {
    const ranksConfig = getRanksConfig();
    const rankIndex = getRankIndex(ranksConfig.rankDefinitions, rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    const rank = ranksConfig.rankDefinitions[rankIndex];
    if (!isDefined(rank)) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    // We strictly prevent deleting "locked" ranks (default system ranks) to ensure the system always has its base structure.
    if (rank.locked === true) {
        return { success: false, message: `Cannot delete locked rank '${rank.name}'.` };
    }

    const deletedRankName = rank.name;
    ranksConfig.rankDefinitions.splice(rankIndex, 1);
    rankIndexCache.clear();
    saveRanksConfig(ranksConfig);
    return { success: true, message: `Rank '${deletedRankName}' deleted successfully.` };
}
