import { loadFriendConfig } from '@core/configurations.js';
import { initialize as initSocial } from '@features/social/friendManager.js';
import { FriendPanelHandler } from '@features/social/ui/friendPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    await loadFriendConfig(isMigration);
    initSocial();
    panelRouter.register(new FriendPanelHandler());
}
