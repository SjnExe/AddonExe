import { panelRouter } from '@ui/PanelRouter.js';
import { SidebarPanelHandler } from '@ui/panels/sidebarPanel.js';
import { InfoPanelHandler } from './infoPanel.js';
import { RankPanelHandler } from './rankPanel.js';

export function initialize() {
    // Core Handlers
    panelRouter.register(new InfoPanelHandler());
    panelRouter.register(new RankPanelHandler());
    panelRouter.register(new SidebarPanelHandler());
}
