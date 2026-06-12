import { loadTeamConfig } from '@core/configurations.js';
import { TeamPanelHandler } from '@features/team/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    await loadTeamConfig(isMigration);
    panelRouter.register(new TeamPanelHandler());
}
