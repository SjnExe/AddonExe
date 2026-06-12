import { loadEconomyConfig } from '@core/configurations.js';
import { BountyPanelHandler } from '@features/economy/ui/bountyPanel.js';
import { EconomyPanelHandler } from '@features/economy/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    await loadEconomyConfig(isMigration);
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new BountyPanelHandler());
}
