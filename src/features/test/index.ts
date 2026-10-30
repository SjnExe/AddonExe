import { infoLog } from '@core/logger.js';
import { loadCommands } from './commands/index.js';

export function initialize(isMigration: boolean) {
    if (isMigration) return;

    infoLog('[TestFeature] Initializing testing framework...');
    loadCommands();
}
