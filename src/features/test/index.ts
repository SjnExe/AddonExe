import { infoLog } from '@core/utils/logger.js';

export function initialize(isMigration: boolean): void {
  if (isMigration) {
    return;
  }
  infoLog('[TestFeature] Initializing testing framework...');
}
