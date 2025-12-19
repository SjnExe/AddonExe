import * as mc from '@minecraft/server';

import { config as Config } from '../config.default.js';

import { getRanksConfig } from './configurations.js';
import { debugLog, errorLog } from './logger.js';
import { RankDefinition } from './ranksConfig.default.js';

let sortedRanks: RankDefinition[] = [];

type ConditionEvaluator = (player: mc.Player, value: unknown, config: typeof Config) => boolean;

/**
 * A map of functions that evaluate rank conditions.
 */
const conditionEvaluators: Record<string, ConditionEvaluator> = {
    /**
     * Checks if the player's name is in the owner list.
     */
    isOwner: (player, _value, config: typeof Config) => {
        const ownerNames = (config.ownerPlayerNames || []).map((name: string) => name.trim().toLowerCase());
        const playerName = player.name.trim().toLowerCase();
        return ownerNames.includes(playerName);
    },
    /**
     * Checks if the player has a specific tag.
     */
    hasTag: (player, value) => {
        return player.hasTag(value as string);
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
 * @param player
 * @param config The addon's configuration object.
 */
export function getPlayerRank(player: mc.Player, config: typeof Config): RankDefinition {
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
    errorLog(
        `[RankManager] CRITICAL: The configured default rank with id "${config.playerDefaults.rankId}" was not found. Please check your configuration.`
    );
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
    return getRanksConfig().rankDefinitions.find((rank) => rank.id === rankId);
}

/**
 * Gets all rank definitions.
 */
export function getAllRanks(): RankDefinition[] {
    return getRanksConfig().rankDefinitions;
}

/**
 * Updates a player's nametag to display their rank and team.
 * @param player The player whose nametag should be updated.
 * @param config The addon's configuration object.
 */
export function updatePlayerNameTag(player: mc.Player, config: typeof Config) {
    const rank = getPlayerRank(player, config);
    const rankPrefix = rank.chatFormatting?.prefixText ?? '';
    const { nameTagStyle = 'above' } = config.ranks || {};

    // Hardcoded brackets: §e[§r PREFIX §e]§r
    const finalPrefix = rankPrefix ? `§e[§r${rankPrefix}§e]§r` : '';

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
            // eslint-disable-next-line unicorn/no-useless-switch-case
            case 'above':
            default: {
                newNameTag = `${finalPrefix}\n${player.name}`;
                break;
            }
        }
    } else {
        newNameTag = player.name;
    }

    // To prevent unnecessary updates and potential Watchdog spikes, only update if the nametag has changed.
    if (player.nameTag !== newNameTag) {
        player.nameTag = newNameTag;
    }
}
