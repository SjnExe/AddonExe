import { serviceLocator } from '@core/services/serviceLocator.js';
import { showChatFilter } from '@features/anticheat/commands/logs.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import { initializeFlagManager } from '@features/anticheat/flagManager.js';
import { addPunishmentLog, initializeLogManager } from '@features/anticheat/logManager.js';
import { initializeXrayDetection } from '@features/anticheat/xray/manager.js';

// Side-effect imports to register default checks into checkRegistry
import '@features/anticheat/itemCheck.js';
import '@features/anticheat/movementCheck.js';
import '@features/anticheat/combatCheck.js';
import '@features/anticheat/miningCheck.js';

export * from '@features/anticheat/core/check.js';
export * from '@features/anticheat/core/checkRegistry.js';
export * from '@features/anticheat/core/graceManager.js';

/**
 * Initializes the anti-cheat framework, log managers, violation storage, and detection checks.
 *
 * @param _isMigration Whether initialization is executing within a data migration step.
 */
export async function initialize(_isMigration: boolean): Promise<void> {
  initializeLogManager();
  initializeFlagManager();
  checkRegistry.startAll();
  initializeXrayDetection();

  serviceLocator.registerService('anticheat.logs', {
    addPunishmentLog,
    showChatFilter,
  });

  const { resetXrayConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('xray', {
    reset: resetXrayConfig,
    message: 'The X-ray configuration section has been reset to default.',
  });
}
