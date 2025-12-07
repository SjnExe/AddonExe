import { panelRouter } from '../PanelRouter.js';
import { AdminPanelHandler } from './adminPanel.js';
import { ConfigPanelHandler } from './configPanel.js';
import { InfoPanelHandler } from './infoPanel.js';
import { PlayerPanelHandler } from './playerPanel.js';

export function initialize() {
    panelRouter.register(new AdminPanelHandler());
    panelRouter.register(new ConfigPanelHandler());
    panelRouter.register(new InfoPanelHandler());
    panelRouter.register(new PlayerPanelHandler());
}
