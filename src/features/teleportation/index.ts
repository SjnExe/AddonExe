import { panelRouter } from '@ui/PanelRouter.js';
import { TeleportPanelHandler } from '@features/teleportation/ui/teleportPanel.js';

export function initialize() {
    panelRouter.register(new TeleportPanelHandler());
}
