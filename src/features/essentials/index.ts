import { loadWorldProtectionConfig } from '@core/configurations.js';
import { WorldProtectionPanelHandler } from '@features/essentials/ui/worldProtectionPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    await loadWorldProtectionConfig(isMigration);
    panelRouter.register(new WorldProtectionPanelHandler());
}
