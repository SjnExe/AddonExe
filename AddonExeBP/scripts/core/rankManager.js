import { getRanksConfig } from './configurations.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';

let sortedRanks = [];

/**
 * A map of functions that evaluate rank conditions.
 * @type {Object.<string, (player: import('@minecraft/server').Player, value: any, config: object) => boolean>}
 */
const conditionEvaluators = {
    /**
     * Checks if the player's name is in the owner list.
     * @param {import('@minecraft/server').Player} player
     * @param {*} value - Not used for this condition.
     * @param {object} config
     * @returns {boolean}
     */
    isOwner: (player, value, config) => {
        const ownerNames = (config.ownerPlayerNames || []).map(name => name.toLowerCase());
        return ownerNames.includes(player.name.toLowerCase());
    },
    /**
     * Checks if the player has a specific tag.
     * @param {import('@minecraft/server').Player} player
     * @param {string} value The tag to check for.
     * @returns {boolean}
     */
    hasTag: (player, value) => {
        return player.hasTag(value);
    },
    /**
     * This is a fallback condition that always returns true.
     * @returns {boolean}
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
    const allRanks = getRanksConfig().rankDefinitions;
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
 * @param {import('@minecraft/server').Player} player
 * @param {object} config The addon's configuration object.
 * @returns {import('./ranksConfig.js').RankDefinition}
 */
export function getPlayerRank(player, config) {
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
 * @param {string} rankId The ID of the rank to get.
 * @returns {import('./ranksConfig.js').RankDefinition | undefined}
 */
export function getRankById(rankId) {
    return getRanksConfig().rankDefinitions.find(rank => rank.id === rankId);
}

/**
 * Gets all rank definitions.
 * @returns {import('./ranksConfig.js').RankDefinition[]}
 */
export function getAllRanks() {
    return getRanksConfig().rankDefinitions;
}
