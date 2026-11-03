import { serviceLocator } from '@core/services/serviceLocator.js';
import { initializeItemBlacklist } from '@features/moderation/blacklist/manager.js';
import { getAvailableDates, getChatLogs, initializeChatLogger } from '@features/moderation/chatLog.js';
import { initializePunishmentManager, loadPunishments } from '@features/moderation/punishmentManager.js';
import { loadReports } from '@features/moderation/reportManager.js';
import { initializeStaffInventoryListener } from '@features/moderation/staffInv/manager.js';
import { initializeWatchManager } from '@features/moderation/watchManager.js';

/** Initializes moderation subsystem services, listeners, and background scanners. */
export async function initialize() {
  loadPunishments();
  initializePunishmentManager();
  loadReports();
  initializeChatLogger();
  initializeWatchManager();
  initializeStaffInventoryListener();
  initializeItemBlacklist();

  serviceLocator.registerService('moderation.chatLogs', {
    getAvailableDates,
    getChatLogs,
  });

  const { resetItemBlacklistConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('itemBlacklist', {
    reset: resetItemBlacklistConfig,
    message: 'The item blacklist configuration section has been reset to default.',
  });
}
