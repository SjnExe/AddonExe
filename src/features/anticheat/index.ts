import { loadAnticheatConfig } from './anticheatConfigLoader.js';
import { startItemCheckLoop } from './itemCheck.js';
import { startMovementCheckLoop } from './movementCheck.js';

export async function initialize(isMigration: boolean) {
    await loadAnticheatConfig(isMigration);
    startItemCheckLoop();
    startMovementCheckLoop();
}
