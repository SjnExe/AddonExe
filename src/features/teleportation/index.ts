import { panelRouter } from '@ui/PanelRouter.js';
import { TeleportPanelHandler } from './ui/teleportPanel.js';

export function initialize() {
    panelRouter.register(new TeleportPanelHandler());
}
