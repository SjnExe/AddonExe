import * as mc from '@minecraft/server';

import * as playerDataManager from '../playerDataManager.js';
import { showPanel } from '../uiManager.js';

export const eventName = 'itemUse';

function handleItemUse(event: mc.ItemUseAfterEvent) {
    const { source: player, itemStack } = event;
    if (itemStack.typeId === 'exe:panel') {
        const pData = playerDataManager.getOrCreatePlayer(player);
        if (pData) {
            showPanel(player, 'mainPanel');
        }
    }
}

export default handleItemUse;
