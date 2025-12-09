import { panelRouter } from '@ui/PanelRouter.js';
import { AdminPanelHandler } from './adminPanel.js';
import { CommandPanelHandler } from './commandPanel.js';
import { ConfigPanelHandler } from './configPanel.js';
import { GeneralPanelHandler } from './generalPanel.js';
import { InfoPanelHandler } from './infoPanel.js';
import { PlayerPanelHandler } from './playerPanel.js';
import { SidebarPanelHandler } from './sidebarPanel.js';

export function initialize() {
    panelRouter.register(new AdminPanelHandler());
    panelRouter.register(new CommandPanelHandler());
    panelRouter.register(new ConfigPanelHandler());
    panelRouter.register(new GeneralPanelHandler());
    panelRouter.register(new InfoPanelHandler());
    panelRouter.register(new PlayerPanelHandler());
    panelRouter.register(new SidebarPanelHandler());
}
