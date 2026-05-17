import { TeleportPanelHandler } from '@features/teleportation/ui/teleportPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new TeleportPanelHandler());
}
