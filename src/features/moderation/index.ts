import { panelRouter } from '@ui/PanelRouter.js';
import { initializeFreezeListener } from '@features/moderation/freezeListener.js';
import { ModerationPanelHandler } from '@features/moderation/ui/moderationPanel.js';
import { XrayPanelHandler } from '@features/moderation/ui/xrayPanel.js';

export function initialize() {
    panelRouter.register(new ModerationPanelHandler());
    panelRouter.register(new XrayPanelHandler());
    initializeFreezeListener();
}
