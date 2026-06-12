import { loadDailyRewardsConfig } from '@core/configurations.js';

export async function initialize(isMigration: boolean) {
    await loadDailyRewardsConfig(isMigration);
}
