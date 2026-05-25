import { loadAnticheatConfig } from '@features/anticheat/configLoader.js';
import { initializeFlagManager } from '@features/anticheat/flagManager.js';
import { startItemCheckLoop } from '@features/anticheat/itemCheck.js';
import { initializeLogManager } from '@features/anticheat/logManager.js';
import { startMovementCheckLoop } from '@features/anticheat/movementCheck.js';

export function initialize(isMigration: boolean) {
    loadAnticheatConfig(isMigration);
    initializeLogManager();
    initializeFlagManager();
    startItemCheckLoop();
    startMovementCheckLoop();
}
