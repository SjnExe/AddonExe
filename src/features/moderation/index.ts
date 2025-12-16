import { panelRouter } from '@ui/PanelRouter.js';
import { initializeFreezeListener } from './freezeListener.js';
import { ModerationPanelHandler } from './ui/moderationPanel.js';
import { XrayPanelHandler } from './ui/xrayPanel.js';

export function initialize() {
    panelRouter.register(new ModerationPanelHandler());
    panelRouter.register(new XrayPanelHandler());
    initializeFreezeListener();
}
