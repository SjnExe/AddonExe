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

    // Core features that cannot be disabled
    const CORE_FEATURES = ['essentials', 'mod', 'ranks', 'ac', 'test'];
    if (CORE_FEATURES.includes(featureId)) {
        return true;
    }

    // Check parent dependencies implicitly (if checking tp.home, make sure tp is active)
    const parts = featureId.split('.');
    if (parts.length > 1) {
        let currentPath = parts[0];
        if (currentPath && !isFeatureActive(currentPath)) return false;

        for (let i = 1; i < parts.length - 1; i++) {
            currentPath += '.' + parts[i];
            if (currentPath && !isFeatureActive(currentPath)) return false;
        }
    }

    if (!isDefined(feature)) {
        // Feature isn't explicitly in the registry module list, but it might be a config subfeature.
        // E.g., 'eco.bounty' might not be a loaded module, just a config flag under economy.
        // We'll handle this in the switch statement below.
    } else {
        // Check explicit dependencies first
        for (const dep of feature.dependencies) {
            if (!isFeatureActive(dep)) return false;
        }
    }

    let mainConfig: Record<string, unknown> | undefined;
    try {
        mainConfig = getConfig();
    } catch {
        // Config might not be ready yet
    }

    switch (featureId) {
        // Main Branches
        case 'eco':
            return mainConfig ? (mainConfig.economy as { enabled?: boolean }).enabled === true : false;
        case 'soc':
            return true; // Social base might not have a toggle, or add one if needed
        case 'tp':
            return true; // Teleport base
        case 'util':
            return true;
        case 'game': {
            const gamesConfigBase = configs.getGamesConfig();
            return isDefined(gamesConfigBase) ? gamesConfigBase.enabled === true : false;
        }

        // Economy Sub-features
        case 'eco.shop':
            return mainConfig ? (mainConfig.shop as { enabled?: boolean }).enabled === true : false;
        case 'eco.ah':
            return mainConfig ? (mainConfig.auctionHouse as { enabled?: boolean }).enabled === true : false;
        case 'eco.bounty':
            return mainConfig ? (mainConfig.bounties as { enabled?: boolean }).enabled === true : false;

        // Utilities
        case 'util.daily':
            return mainConfig ? (mainConfig.dailyRewards as { enabled?: boolean }).enabled === true : false;
        case 'util.vote':
            return mainConfig ? (mainConfig.voting as { enabled?: boolean }).enabled === true : false;
        case 'util.kit':
            return mainConfig ? (mainConfig.kits as { enabled?: boolean }).enabled === true : false;
        case 'util.sidebar': {
            const sidebarConfig = configs.getSidebarConfig();
            return isDefined(sidebarConfig) ? sidebarConfig.enabled === true : false;
        }

        // Social Sub-features
        case 'soc.team': {
            const teamConfig = configs.getTeamConfig();
            return isDefined(teamConfig) ? teamConfig.enabled === true : false;
        }

        // Game Sub-features
        case 'game.wordle':
            // No direct toggle for wordle yet? Let's say true if game is true, or check wordleConfig
            return true;

        // Teleport Sub-features
        case 'tp.home':
            return mainConfig ? (mainConfig.homes as { enabled?: boolean }).enabled === true : false;
        case 'tp.tpa':
            return mainConfig ? (mainConfig.tpa as { enabled?: boolean }).enabled === true : false;
        case 'tp.rtp':
            return mainConfig ? (mainConfig.rtp as { enabled?: boolean }).enabled === true : false;
        case 'tp.warp':
            return mainConfig ? (mainConfig.warps as { enabled?: boolean }).enabled === true : false;
        case 'tp.back':
            return mainConfig ? (mainConfig.back as { enabled?: boolean }).enabled === true : false;
        case 'tp.spawn':
            // spawn doesn't have an enabled toggle in config typically, but if it does, check here
            return true;

        default:
            // Unknown features or those without explicit toggles are assumed to be active
            // as long as their parents passed.
            return true;
    }
}
