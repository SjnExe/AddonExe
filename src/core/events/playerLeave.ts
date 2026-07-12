import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { debugLog } from '@core/logger.js';
import * as playerCache from '@core/playerCache.js';
import * as playerDataManager from '@core/playerDataManager.js';
import { formatString } from '@core/utils.js';

export const eventName = 'playerLeave';

function handlePlayerLeave(event: mc.PlayerLeaveAfterEvent) {
    const pData = playerDataManager.getPlayer(event.playerId);
    const config = getConfig();
    const joinLeaveConfig = config.playerInfo.customJoinLeave;

    if (joinLeaveConfig.enabled === true && pData?.isVanished !== true) {
        const msg = formatString(joinLeaveConfig.leaveMessage, { playerName: event.playerName });
        mc.world.sendMessage(msg);
    }

    playerDataManager.handlePlayerLeave(event.playerId);
    playerCache.removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;
