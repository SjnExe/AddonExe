import { getConfig } from '@core/config/configManager.js';
import * as playerCache from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { formatString } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { handleCombatPlayerLeave } from '@features/essentials/combatManager.js';
import * as mc from '@minecraft/server';

export const eventName = 'playerLeave';

function handlePlayerLeave(event: mc.PlayerLeaveAfterEvent) {
    const pData = playerDataManager.getPlayer(event.playerId);
    const config = getConfig();
    const joinLeaveConfig = config.playerInfo.customJoinLeave;

    if (joinLeaveConfig.enabled === true && pData?.isVanished !== true) {
        const msg = formatString(joinLeaveConfig.leaveMessage, { playerName: event.playerName });
        mc.world.sendMessage(msg);
    }

    handleCombatPlayerLeave(event.playerId, event.playerName);
    playerDataManager.handlePlayerLeave(event.playerId);
    playerCache.removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;
