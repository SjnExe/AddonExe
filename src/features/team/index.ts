import { serviceLocator } from '@core/services/serviceLocator.js';
import { getTeamByPlayer } from '@features/team/manager.js';

export async function initialize(_isMigration: boolean) {
    serviceLocator.registerService('team.manager', {
        getTeamByPlayer
    });

    // Register configurations
    const { resetTeamConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('team', {
        reset: resetTeamConfig,
        message: 'The team configuration section has been reset to default.'
    });
}
