import { serviceLocator } from '@core/services/serviceLocator.js';
import { showChatFilter } from '@features/anticheat/commands/logs.js';
import { loadAnticheatConfig } from '@features/anticheat/configLoader.js';
import { initializeFlagManager } from '@features/anticheat/flagManager.js';
import { startItemCheckLoop } from '@features/anticheat/itemCheck.js';
import { addPunishmentLog, initializeLogManager } from '@features/anticheat/logManager.js';
import { startMovementCheckLoop } from '@features/anticheat/movementCheck.js';

export async function initialize(isMigration: boolean) {
    loadAnticheatConfig(isMigration);
    initializeLogManager();
    initializeFlagManager();
    startItemCheckLoop();
    startMovementCheckLoop();

    serviceLocator.registerService('anticheat.logs', {
        addPunishmentLog,
        showChatFilter
    });

    // Register configurations
    const { loadXrayConfig, resetXrayConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadXrayConfig(isMigration);
    registerConfigReset('xray', {
        reset: resetXrayConfig,
        message: 'The X-ray configuration section has been reset to default.'
    });
}
