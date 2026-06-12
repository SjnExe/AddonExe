import { loadXrayConfig } from '@core/configurations.js';
import { loadAnticheatConfig } from '@features/anticheat/configLoader.js';
import { initializeFlagManager } from '@features/anticheat/flagManager.js';
import { startItemCheckLoop } from '@features/anticheat/itemCheck.js';
import { initializeLogManager } from '@features/anticheat/logManager.js';
import { startMovementCheckLoop } from '@features/anticheat/movementCheck.js';

export async function initialize(isMigration: boolean) {
    await loadXrayConfig(isMigration);
    loadAnticheatConfig(isMigration);
    initializeLogManager();
    initializeFlagManager();
    startItemCheckLoop();
    startMovementCheckLoop();
}
