import { loadAnticheatConfig } from './anticheatConfigLoader.js';
import { initializeFlagManager } from './flagManager.js';
import { startItemCheckLoop } from './itemCheck.js';
import { initializeLogManager } from './logManager.js';
import { startMovementCheckLoop } from './movementCheck.js';

export async function initialize(isMigration: boolean) {
    await loadAnticheatConfig(isMigration);
    initializeLogManager();
    initializeFlagManager();
    startItemCheckLoop();
    startMovementCheckLoop();
}
