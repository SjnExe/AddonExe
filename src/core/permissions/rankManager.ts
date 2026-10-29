import { CommandExecutor } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getRanksConfig, saveRanksConfig } from '@core/config/configurations.js';
import { findPlayerByName, getPlayerFromCache } from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import { developerBadge, isDeveloperPlayer } from '@core/utils/constants.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { isPlayerAfk } from '@features/essentials/afk/manager.js';
import { RankDefinition } from '@features/ranks/config.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

import { config as Config } from '../../config.js';

let sortedRanks: RankDefinition[] = [];

// Cache for player ranks: Map<playerId, { rank: RankDefinition, tick: number }>
const rankCache = new Map<string, { rank: RankDefinition; tick: number }>();

// Cache for rank definitions by ID for O(1) lookups
const ranksMap = new Map<string, RankDefinition>();

/**
 * Reloads and sorts the ranks from the config manager cache. This can be called to refresh ranks after they've been
 * modified in the UI.
 */
export function reloadRanks() {
  const allRanks = getRanksConfig().rankDefinitions;
  sortedRanks = [...allRanks].toSorted((a, b) => a.priority - b.priority);

  // Rebuild ranks map
  ranksMap.clear();
  for (const rank of allRanks) {
    ranksMap.set(rank.id, rank);
  }

  // Clear cache on reload
  rankCache.clear();
  import('@core/permissions/permissionEngine.js').then((m) => m.invalidateAllRankCaches()).catch(() => {});
  debugLog(`[RankManager] Reloaded and sorted ${sortedRanks.length} ranks.`);
}

/** Initializes the rank manager by loading and sorting ranks. This is called once at startup. */
export function clearPlayerRankCache(playerId: string): void {
  rankCache.delete(playerId);
}

export function initialize() {
  reloadRanks();
  debugLog(`[RankManager] Initialized ${sortedRanks.length} ranks.`);
}

/**
 * Gets the highest priority rank for a given player. Uses the permission engine to fetch all active ranks and returns
 * the one with the lowest priority number.
 *
 * @param player
 * @param config The addon's configuration object.
 */
export function getPlayerRank(player: mc.Player, config: typeof Config = getConfig()): RankDefinition {
  const currentTick = mc.system.currentTick;
  const cached = rankCache.get(player.id);

  if (cached && currentTick - cached.tick < 20) {
    return cached.rank;
  }

  const ranks = permissionEngine.getPlayerRanks(player);
  let highestRank: RankDefinition | undefined = undefined;

  for (const rank of ranks) {
    if (!highestRank || rank.priority < highestRank.priority) {
      highestRank = rank;
    }
  }

  if (highestRank) {
    rankCache.set(player.id, { rank: highestRank, tick: currentTick });
    return highestRank;
  }

  // Fallback to the configured default rank if no conditions are met
  const defaultRank = getRankById(config.playerDefaults.rankId);
  if (isDefined(defaultRank)) {
    rankCache.set(player.id, { rank: defaultRank, tick: currentTick });
    return defaultRank;
  }

  // If the configured default rank doesn't exist, log an error and return a minimal, safe fallback.
  errorLog(
    `[RankManager] CRITICAL: The configured default rank with id "${config.playerDefaults.rankId}" was not found. Please check your configuration.`,
  );
  const fallback: RankDefinition = {
    id: 'fallback',
    name: 'Fallback',
    priority: 1000,
    groups: ['default'],
    allow: [],
    deny: [],
    conditions: [{ type: 'default' }],
    chatFormatting: { prefixText: '', nameColor: '§7', messageColor: '§r' },
  };
  rankCache.set(player.id, { rank: fallback, tick: currentTick });
  return fallback;
}

/**
 * Checks if a player or console executor can target another player based on rank priorities. Returns true if the
 * executor's highest rank priority is mathematically lower (higher importance) than the target's highest rank priority.
 * Console always returns true.
 *
 * @param executor The player or console executing the command.
 * @param targetId The ID of the targeted player.
 * @param config The addon's configuration object.
 */
export function canTarget(
  executor: mc.Player | CommandExecutor,
  targetId: string,
  config: typeof Config = getConfig(),
): boolean {
  if (!(executor instanceof mc.Player)) {
    // Console can target anyone
    return true;
  }

  if (executor.id === targetId) {
    // Cannot target self in most hierarchical checks
    return false;
  }

  const executorRank = getPlayerRank(executor, config);

  // Attempt to resolve target rank. Target might be offline.
  let targetRankPriority = 1000;

  // Check if target is online
  const targetPlayer = getPlayerFromCache(targetId) || findPlayerByName(targetId);
  if (targetPlayer) {
    const targetRank = getPlayerRank(targetPlayer, config);
    targetRankPriority = targetRank.priority;
  } else {
    // Target is offline, try to load data
    const targetData = playerDataManager.loadPlayerData(targetId);
    if (targetData && targetData.ranks.length > 0) {
      let highestOfflinePriority = 1000;
      for (const rankId of targetData.ranks) {
        const rank = getRankById(rankId);
        if (rank && rank.priority < highestOfflinePriority) {
          highestOfflinePriority = rank.priority;
        }
      }
      targetRankPriority = highestOfflinePriority;
    } else {
      // Fallback for offline player with no data or ranks, assume lowest priority
      const defaultRank = getRankById(config.playerDefaults.rankId);
      if (defaultRank) {
        targetRankPriority = defaultRank.priority;
      }
    }
  }

  return executorRank.priority < targetRankPriority;
}

/**
 * Gets a rank definition by its ID.
 *
 * @param rankId The ID of the rank to get.
 */
export function getRankById(rankId: string): RankDefinition | undefined {
  const cachedRank = ranksMap.get(rankId);
  if (cachedRank) {
    return cachedRank;
  }

  // Fallback if map isn't populated yet (e.g. before initialization)
  const allRanks = getRanksConfig().rankDefinitions;
  const rank = allRanks.find((r) => r.id === rankId);
  if (rank) {
    ranksMap.set(rank.id, rank);
  }
  return rank;
}

/** Gets all rank definitions. */
export function getAllRanks(): RankDefinition[] {
  return getRanksConfig().rankDefinitions;
}

/**
 * Updates a player's nametag to display their rank and team.
 *
 * @param player The player whose nametag should be updated.
 * @param config The addon's configuration object.
 */
export function updatePlayerNameTag(player: mc.Player, config: typeof Config = getConfig()) {
  // Invalidate caches to force fresh calculation when explicitly updating nametags
  rankCache.delete(player.id);
  permissionEngine.invalidatePlayerPermissionCache(player.id);

  const rank = getPlayerRank(player, config);
  const rankPrefix =
    (isDefined(rank.chatFormatting) ? rank.chatFormatting.prefixText : undefined) ?? rank.nametagPrefix ?? '';
  const nameTagStyle = (isDefined(config.ranks) ? config.ranks.nameTagStyle : undefined) ?? 'above';

  // Hardcoded brackets: §e[§r PREFIX §e]§r
  const afkPrefix = isPlayerAfk(player.id) ? '§7[AFK]§r' : '';
  const devPrefix = isDeveloperPlayer(player.name) ? developerBadge : '';
  const baseRankPrefix = rankPrefix === '' ? '' : `§e[§r${rankPrefix}§e]§r`;
  const finalPrefix = [afkPrefix, devPrefix, baseRankPrefix].filter(Boolean).join(' ');

  let newNameTag: string;

  if (finalPrefix) {
    switch (nameTagStyle) {
      case 'before': {
        newNameTag = `${finalPrefix} ${player.name}`;
        break;
      }
      case 'after': {
        newNameTag = `${player.name} ${finalPrefix}`;
        break;
      }
      case 'under': {
        newNameTag = `${player.name}\n${finalPrefix}`;
        break;
      }
      default: {
        newNameTag = `${finalPrefix}\n${player.name}`;
        break;
      }
    }
  } else {
    newNameTag = player.name;
  }

  if (player.nameTag !== newNameTag) {
    player.nameTag = newNameTag;
  }
}

/** Adds a new rank definition and persists the ranks configuration. */
export function addRank(rankData: RankDefinition): { success: boolean; message: string } {
  const ranksConfig = getRanksConfig();
  if (isDefined(getRankById(rankData.id))) {
    return { success: false, message: `Rank with ID '${rankData.id}' already exists.` };
  }
  ranksConfig.rankDefinitions.push(rankData);
  saveRanksConfig(ranksConfig);
  reloadRanks();
  return { success: true, message: `Rank '${rankData.name}' added successfully.` };
}

/** Updates an existing rank definition and persists the ranks configuration. */
export function updateRank(
  rankId: string,
  updatedData: Partial<RankDefinition>,
): { success: boolean; message: string } {
  const ranksConfig = getRanksConfig();
  const rankIndex = ranksConfig.rankDefinitions.findIndex((r) => r.id === rankId);
  if (rankIndex === -1) {
    return { success: false, message: `Rank with ID '${rankId}' not found.` };
  }

  const originalRank = ranksConfig.rankDefinitions[rankIndex];
  if (!isDefined(originalRank)) {
    return { success: false, message: `Rank with ID '${rankId}' not found.` };
  }

  if (originalRank.locked === true && isDefined(updatedData.id) && updatedData.id !== originalRank.id) {
    return { success: false, message: 'Cannot change the ID of a locked rank.' };
  }

  if (isDefined(updatedData.id) && updatedData.id !== rankId && isDefined(getRankById(updatedData.id))) {
    return { success: false, message: `Cannot rename rank ID to '${updatedData.id}' as it already exists.` };
  }

  let message = `Rank '${updatedData.name ?? originalRank.name}' updated successfully.`;
  if (isNonEmptyString(updatedData.id) && updatedData.id !== rankId) {
    message += `\n§eWARNING:§r The rank ID was changed from '${rankId}' to '${updatedData.id}'.`;
  }

  let finalRank = { ...originalRank, ...updatedData };
  if (rankId === 'owner') {
    finalRank = {
      ...finalRank,
      id: originalRank.id,
      priority: originalRank.priority,
      allow: originalRank.allow,
      deny: originalRank.deny,
      groups: originalRank.groups,
      conditions: originalRank.conditions,
    };
  } else if (rankId === 'member') {
    finalRank = {
      ...finalRank,
      id: originalRank.id,
      priority: originalRank.priority,
    };
  }

  ranksConfig.rankDefinitions[rankIndex] = finalRank;
  saveRanksConfig(ranksConfig);
  reloadRanks();
  return { success: true, message };
}

/** Deletes a rank definition if it is not locked. */
export function deleteRank(rankId: string): { success: boolean; message: string } {
  const ranksConfig = getRanksConfig();
  const rankIndex = ranksConfig.rankDefinitions.findIndex((r) => r.id === rankId);
  if (rankIndex === -1) {
    return { success: false, message: `Rank with ID '${rankId}' not found.` };
  }

  const rank = ranksConfig.rankDefinitions[rankIndex];
  if (!isDefined(rank)) {
    return { success: false, message: `Rank with ID '${rankId}' not found.` };
  }

  if (rank.locked === true) {
    return { success: false, message: `Cannot delete locked rank '${rank.name}'.` };
  }

  const deletedRankName = rank.name;
  ranksConfig.rankDefinitions.splice(rankIndex, 1);
  saveRanksConfig(ranksConfig);
  reloadRanks();
  return { success: true, message: `Rank '${deletedRankName}' deleted successfully.` };
}
