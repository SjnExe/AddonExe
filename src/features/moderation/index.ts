import { serviceLocator } from '@core/services/serviceLocator.js';
import { getAvailableDates, getChatLogs } from '@features/moderation/chatLogManager.js';
import { initializeFreezeListener } from '@features/moderation/freezeListener.js';

import { initializeWatchManager } from '@features/moderation/watchManager.js';

export function initialize() {
    initializeFreezeListener();
    initializeWatchManager();

    serviceLocator.registerService('moderation.chatLogs', {
        getAvailableDates,
        getChatLogs
    });
}
