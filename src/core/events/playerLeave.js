import { debugLog } from '../logger.js';
import * as playerCache from '../playerCache.js';
import * as playerDataManager from '../playerDataManager.js';

export const eventName = 'playerLeave';

function handlePlayerLeave(event) {
    playerDataManager.handlePlayerLeave(event.playerId);
    playerCache.removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;
