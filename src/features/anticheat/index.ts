import { serviceLocator } from '@core/services/serviceLocator.js';
import { startCombatCheck } from '@features/anticheat/combatCheck.js';
import { showChatFilter } from '@features/anticheat/commands/logs.js';
import { initializeFlagManager } from '@features/anticheat/flagManager.js';
import { startItemCheckLoop } from '@features/anticheat/itemCheck.js';
import { addPunishmentLog, initializeLogManager } from '@features/anticheat/logManager.js';
import { startMovementCheckLoop } from '@features/anticheat/movementCheck.js';
import { initializeXrayDetection } from '@features/anticheat/xray/manager.js';

export async function initialize(_isMigration: boolean) {
  initializeLogManager();
  initializeFlagManager();
  startItemCheckLoop();
  startMovementCheckLoop();
  startCombatCheck();
  initializeXrayDetection();

  serviceLocator.registerService('anticheat.logs', {
    addPunishmentLog,
    showChatFilter,
  });

  // Register configurations
  const { resetXrayConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('xray', {
    reset: resetXrayConfig,
    message: 'The X-ray configuration section has been reset to default.',
  });
}
