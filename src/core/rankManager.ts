import { getRanksConfig } from './configurations.js';
import { debugLog, errorLog } from './logger.js';
import * as mc from '@minecraft/server';
import { RankDefinition } from './ranksConfig.js';

let sortedRanks: RankDefinition[] = [];

type ConditionEvaluator = (player: mc.Player, value: any, config: any) => boolean;

/**
 * A map of functions that evaluate rank conditions.
 */
const conditionEvaluators: Record<string, ConditionEvaluator> = {
    /**
     * Checks if the player's name is in the owner list.
     */
    isOwner: (player, value, config) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ownerNames = (config.ownerPlayerNames || []).map((name: any) => name.toLowerCase());
        return ownerNames.includes(player.name.toLowerCase());
    },
    /**
     * Checks if the player has a specific tag.
     */
    hasTag: (player, value) => {
        return player.hasTag(value);
    },
    /**
     * This is a fallback condition that always returns true.
     */
    default: () => {
        return true;
    }
};

/**
 * Reloads and sorts the ranks from the config manager cache.
 * This can be called to refresh ranks after they've been modified in the UI.
 */
export function reloadRanks() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRanks = (getRanksConfig() as any).rankDefinitions as RankDefinition[];
    sortedRanks = [...allRanks].sort((a, b) => a.permissionLevel - b.permissionLevel);
    debugLog(`[RankManager] Reloaded and sorted ${sortedRanks.length} ranks.`);
}

/**
 * Initializes the rank manager by loading and sorting ranks.
 * This is called once at startup.
 */
export function initialize() {
    reloadRanks();
    debugLog(`[RankManager] Initialized ${sortedRanks.length} ranks.`);
}

/**
 * Gets the rank for a given player by evaluating conditions.
 * @param player
 * @param config The addon's configuration object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPlayerRank(player: mc.Player, config: any): RankDefinition {
    for (const rank of sortedRanks) {
        let allConditionsMet = true;
        for (const condition of rank.conditions) {
            const evaluator = conditionEvaluators[condition.type];
            if (!evaluator || !evaluator(player, condition.value, config)) {
                allConditionsMet = false;
                break; // Move to the next rank if any condition fails
            }
        }

        if (allConditionsMet) {
            return rank;
        }
    }

    // Fallback to the configured default rank if no conditions are met
    const defaultRank = getRankById(config.playerDefaults.rankId);
    if (defaultRank) {
        return defaultRank;
    }

    // If the configured default rank doesn't exist, log an error and return a minimal, safe fallback.
    errorLog(`[RankManager] CRITICAL: The configured default rank with id "${config.playerDefaults.rankId}" was not found. Please check your configuration.`);
    return {
        id: 'fallback',
        name: 'Fallback',
        permissionLevel: 1024,
        conditions: [{ type: 'default' }],
        chatFormatting: { prefixText: '', nameColor: '§7', messageColor: '§r' }
    };
}

/**
 * Gets a rank definition by its ID.
 * @param rankId The ID of the rank to get.
 */
export function getRankById(rankId: string): RankDefinition | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((getRanksConfig() as any).rankDefinitions as RankDefinition[]).find(rank => rank.id === rankId);
}

/**
 * Gets all rank definitions.
 */
export function getAllRanks(): RankDefinition[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getRanksConfig() as any).rankDefinitions;
}

/**
 * Updates a player's nametag to display their rank and team.
 * @param player The player whose nametag should be updated.
 * @param config The addon's configuration object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updatePlayerNameTag(player: mc.Player, config: any) {
    const rank = getPlayerRank(player, config);
    const rankPrefix = rank.chatFormatting?.prefixText ?? '';
    const { nameTagStyle = 'above' } = config.ranks || {};

    // Hardcoded brackets: §e[§r PREFIX §e]§r
    const finalPrefix = rankPrefix ? `§e[§r${rankPrefix}§e]§r` : '';

    let newNameTag;
    switch (nameTagStyle) {
        case 'before':
            newNameTag = finalPrefix ? `${finalPrefix} ${player.name}` : player.name;
            break;
        case 'after':
            newNameTag = finalPrefix ? `${player.name} ${finalPrefix}` : player.name;
            break;
        case 'under':
            newNameTag = `${player.name}\n${finalPrefix}`;
            break;
        case 'above':
        default:
            newNameTag = `${finalPrefix}\n${player.name}`;
            break;
    }

    // To prevent unnecessary updates and potential Watchdog spikes, only update if the nametag has changed.
    if (player.nameTag !== newNameTag) {
        player.nameTag = newNameTag;
    }
}
