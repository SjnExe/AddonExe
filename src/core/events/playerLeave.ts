import * as mc from '@minecraft/server';

import { getConfig } from '../configManager.js';
import { debugLog } from '../logger.js';
import { formatString } from '../utils.js';
import * as playerCache from '../playerCache.js';
import * as playerDataManager from '../playerDataManager.js';

export const eventName = 'playerLeave';

function handlePlayerLeave(event: mc.PlayerLeaveAfterEvent) {
    const pData = playerDataManager.getPlayer(event.playerId);
    const config = getConfig();
    const joinLeaveConfig = config.playerInfo?.customJoinLeave;

    if (joinLeaveConfig?.enabled) {
        if (!pData?.isVanished) {
            const msg = formatString(joinLeaveConfig.leaveMessage, { playerName: event.playerName });
            mc.world.sendMessage(msg);
        }
    }

    playerDataManager.handlePlayerLeave(event.playerId);
    playerCache.removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;
