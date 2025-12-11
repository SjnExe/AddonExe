import { Config, getConfig, onConfigUpdated, updateConfig } from './configManager.js';
import { debugLog } from './logger.js';

function checkDependencies(config: Config) {
    // Define dependencies: Feature -> Dependency
    // Keys must match property names in Config
    const dependencies: Record<string, string[]> = {
        shop: ['economy'],
        auctionHouse: ['economy'],
        bounties: ['economy']
    };

    // Cast to generic record to allow dynamic access
    const typedConfig = config as unknown as Record<string, { enabled?: boolean }>;

    for (const feature in dependencies) {
        const featureEnabled = typedConfig[feature]?.enabled;

        if (featureEnabled) {
            const deps = dependencies[feature];
            for (const dep of deps) {
                const depEnabled = typedConfig[dep]?.enabled;

                if (!depEnabled) {
                    debugLog(`[FeatureDependencies] Enabling '${dep}' because '${feature}' is enabled.`);
                    updateConfig(`${dep}.enabled`, true);
                }
            }
        }
    }
}

export function initializeFeatureDependencies() {
    // Initial check
    const config = getConfig();
    if (config) {
        checkDependencies(config);
    }

    onConfigUpdated(checkDependencies);
}
