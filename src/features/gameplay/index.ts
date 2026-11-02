import { registerConfigReset, resetGameplayConfig } from '@core/config/configurations.js';

import { initializeGameplayMechanics, syncGameplayGamerules } from './manager.js';

/** Initializes the gameplay mechanics system (knockback scaling, fall damage prevention, keepInventory, void rescue). */
export function initialize(): void {
  initializeGameplayMechanics();

  registerConfigReset('gameplay', {
    reset: resetGameplayConfig,
    message: 'The Gameplay configuration section has been reset to default.',
    postResetCallback: () => {
      syncGameplayGamerules();
    },
  });
}
