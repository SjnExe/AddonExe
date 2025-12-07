import { panelRouter } from '../../core/ui/PanelRouter.js';
import { BountyPanelHandler } from './ui/bountyPanel.js';
import { EconomyPanelHandler } from './ui/economyPanel.js';

export function initialize() {
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new BountyPanelHandler());
}
