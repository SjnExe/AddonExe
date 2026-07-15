import { panelRouter } from '@ui/PanelRouter.js';
import { SidebarPanelHandler } from '@ui/panels/sidebarPanel.js';
import { GeneralPanelHandler } from './generalPanel.js';
import { InfoPanelHandler } from './infoPanel.js';
import { RankPanelHandler } from './rankPanel.js';

export function initialize() {
    // Core Handlers
    panelRouter.register(new GeneralPanelHandler());
    panelRouter.register(new InfoPanelHandler());
    panelRouter.register(new RankPanelHandler());
    panelRouter.register(new SidebarPanelHandler());
}
