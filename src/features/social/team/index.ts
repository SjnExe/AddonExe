import { serviceLocator } from '@core/services/serviceLocator.js';
import { getTeamByPlayer, initialize as initializeTeams } from '@features/social/team/manager.js';

export async function initialize(_isMigration: boolean) {
    initializeTeams();
    serviceLocator.registerService('team.manager', {
        getTeamByPlayer
    });

    // Register configurations
    const { resetTeamConfig, registerConfigReset } = await import('@core/config/configurations.js');
    registerConfigReset('team', {
        reset: resetTeamConfig,
        message: 'The team configuration section has been reset to default.'
    });
}
