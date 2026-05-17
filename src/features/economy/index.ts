import { BountyPanelHandler } from '@features/economy/ui/bountyPanel.js';
import { EconomyPanelHandler } from '@features/economy/ui/economyPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new BountyPanelHandler());
}
