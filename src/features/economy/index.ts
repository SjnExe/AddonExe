import { BountyPanelHandler } from '@features/economy/ui/bountyPanel.js';
import { EconomyPanelHandler } from '@features/economy/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new BountyPanelHandler());

    // Register configurations
    const { loadEconomyConfig, resetEconomyConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadEconomyConfig(isMigration);
    registerConfigReset('economy', {
        reset: resetEconomyConfig,
        message: 'The economy configuration section has been reset to default.'
    });
}
