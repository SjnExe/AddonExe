import { panelRouter } from '../../core/ui/PanelRouter.js';
import { ModerationPanelHandler } from './ui/moderationPanel.js';

export function initialize() {
    panelRouter.register(new ModerationPanelHandler());
}
