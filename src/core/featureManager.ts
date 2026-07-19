import { getConfig } from '@core/configManager.js';
import * as configs from '@core/configurations.js';
import { featureRegistry } from '@core/featureRegistry.js';
import { isDefined } from '@lib/guards.js';

/**
 * Checks if a feature and all its dependencies are currently active.
 * @param featureId The ID of the feature to check.
 * @returns true if the feature and its dependencies are active, false otherwise.
 */
export function isFeatureActive(featureId: string): boolean {
    const feature = featureRegistry.find((f) => f.id === featureId);
    if (!isDefined(feature)) return false;

    // Core features that cannot be disabled
    const CORE_FEATURES = ['essentials', 'moderation', 'ranks', 'social', 'teleport', 'anticheat', 'test'];

    // Check dependencies first
    for (const dep of feature.dependencies) {
        if (!isFeatureActive(dep)) return false;
    }

    if (CORE_FEATURES.includes(featureId)) {
        return true;
    }

    let mainConfig: Record<string, unknown> | undefined;
    try {
        mainConfig = getConfig();
    } catch {
        // Config might not be ready yet
    }

    switch (featureId) {
        case 'economy':
            return mainConfig ? (mainConfig.economy as { enabled?: boolean }).enabled === true : false;
        case 'shop':
            return mainConfig ? (mainConfig.shop as { enabled?: boolean }).enabled === true : false;
        case 'auction':
            return mainConfig ? (mainConfig.auctionHouse as { enabled?: boolean }).enabled === true : false;
        case 'daily':
            return mainConfig ? (mainConfig.dailyRewards as { enabled?: boolean }).enabled === true : false;
        case 'vote':
            return mainConfig ? (mainConfig.voting as { enabled?: boolean }).enabled === true : false;
        case 'kit':
            return mainConfig ? (mainConfig.kits as { enabled?: boolean }).enabled === true : false;

        case 'sidebar': {
            const sidebarConfig = configs.getSidebarConfig();
            return isDefined(sidebarConfig) ? sidebarConfig.enabled === true : false;
        }
        case 'games': {
            const gamesConfig = configs.getGamesConfig();
            return isDefined(gamesConfig) ? gamesConfig.enabled === true : false;
        }
        case 'team': {
            const teamConfig = configs.getTeamConfig();
            return isDefined(teamConfig) ? teamConfig.enabled === true : false;
        }
        default:
            // Features without explicit toggles are assumed to be active.
            return true;
    }
}
