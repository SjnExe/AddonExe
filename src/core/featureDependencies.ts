import { isDefined } from '@lib/guards.js';
import { getConfig, onConfigUpdated, updateConfig } from '@core/configManager.js';
import { debugLog } from '@core/logger.js';

function checkDependencies(config: unknown) {
    // Define dependencies: Feature -> Dependency
    // Keys must match property names in Config
    const dependencies: Record<string, string[]> = {
        shop: ['economy'],
        auctionHouse: ['economy'],
        bounties: ['economy']
    };

    // Cast to generic record to allow dynamic access
    const typedConfig = config as Record<string, { enabled?: boolean }>;

    for (const feature in dependencies) {
        const featureConfig = typedConfig[feature];
        const featureEnabled = isDefined(featureConfig) ? featureConfig.enabled : undefined;

        if (featureEnabled === true) {
            const deps = dependencies[feature];
            if (!isDefined(deps)) continue;
            for (const dep of deps) {
                const depConfig = typedConfig[dep];
                const depEnabled = isDefined(depConfig) ? depConfig.enabled : undefined;

                if (depEnabled !== true) {
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
    if (isDefined(config)) {
        checkDependencies(config);
    }

    onConfigUpdated(checkDependencies);
}
