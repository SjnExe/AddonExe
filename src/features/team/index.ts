import { TeamPanelHandler } from '@features/team/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new TeamPanelHandler());
}
