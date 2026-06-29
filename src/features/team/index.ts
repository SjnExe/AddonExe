import { serviceLocator } from '@core/services/serviceLocator.js';
import { getTeamByPlayer } from '@features/team/manager.js';
import { TeamPanelHandler } from '@features/team/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(_isMigration: boolean) {
    panelRouter.register(new TeamPanelHandler());

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
