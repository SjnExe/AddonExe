import { WorldProtectionPanelHandler } from '@features/essentials/ui/worldProtectionPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new WorldProtectionPanelHandler());
}
