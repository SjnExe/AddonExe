import { showPanel } from '../uiManager.js';
import * as playerDataManager from '../playerDataManager.js';

export const eventName = 'itemUse';

function handleItemUse(event) {
    const { source: player, itemStack } = event;
    if (itemStack.typeId === 'exe:panel') {
        const pData = playerDataManager.getOrCreatePlayer(player);
        if (pData) {
            showPanel(player, 'mainPanel');
        }
    }
}

export default handleItemUse;