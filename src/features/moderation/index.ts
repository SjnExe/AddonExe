import { serviceLocator } from '@core/services/serviceLocator.js';
import { getAvailableDates, getChatLogs, initializeChatLogger } from '@features/moderation/chatLog.js';
import { initializeFreezeListener } from '@features/moderation/freezeListener.js';
import { initializePunishmentManager, loadPunishments } from '@features/moderation/punishmentManager.js';
import { loadReports } from '@features/moderation/reportManager.js';
import { initializeStaffInventoryListener } from '@features/moderation/staffInv/manager.js';
import { initializeWatchManager } from '@features/moderation/watchManager.js';

export function initialize() {
  loadPunishments();
  initializePunishmentManager();
  loadReports();
  initializeChatLogger();
  initializeFreezeListener();
  initializeWatchManager();
  initializeStaffInventoryListener();

  serviceLocator.registerService('moderation.chatLogs', {
    getAvailableDates,
    getChatLogs,
  });
}
