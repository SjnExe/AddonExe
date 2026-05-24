import { TeleportPanelHandler } from '@features/teleport/ui/teleportPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new TeleportPanelHandler());
}
