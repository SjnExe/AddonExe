import * as mc from '@minecraft/server';

import * as playerDataManager from '@core/playerDataManager.js';

export const eventName = 'itemUse';

async function handleItemUse(event: mc.ItemUseAfterEvent) {
    const { source: player, itemStack } = event;
    if (itemStack.typeId === 'exe:panel') {
        playerDataManager.getOrCreatePlayer(player);
        const { showMainPanel } = await import('@core/ui/panels/mainPanel.js');
        void showMainPanel(player);
    }
}

export default handleItemUse;
