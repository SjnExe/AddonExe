import { serviceLocator } from '@core/services/serviceLocator.js';
import { getLeaderboard } from '@features/economy/leaderboardManager.js';
import { BountyPanelHandler } from '@features/economy/ui/bountyPanel.js';
import { EconomyPanelHandler } from '@features/economy/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new BountyPanelHandler());

    serviceLocator.registerService('economy.leaderboard', {
        getLeaderboard
    });

    // Register configurations
    const { resetEconomyConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('economy', {
        reset: resetEconomyConfig,
        message: 'The economy configuration section has been reset to default.'
    });
}
