import { serviceLocator } from '@core/services/serviceLocator.js';
import { getAvailableDates, getChatLogs } from '@features/moderation/chatLogManager.js';
import { initializeFreezeListener } from '@features/moderation/freezeListener.js';
import { ModerationPanelHandler } from '@features/moderation/ui/panel.js';
import { XrayPanelHandler } from '@features/moderation/ui/xrayPanel.js';
import { initializeWatchManager } from '@features/moderation/watchManager.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new ModerationPanelHandler());
    panelRouter.register(new XrayPanelHandler());
    initializeFreezeListener();
    initializeWatchManager();

    serviceLocator.registerService('moderation.chatLogs', {
        getAvailableDates,
        getChatLogs
    });
}
