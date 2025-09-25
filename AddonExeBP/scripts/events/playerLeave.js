import * as playerDataManager from '../core/playerDataManager.js';
import * as playerCache from '../core/playerCache.js';
import { debugLog } from '../core/logger.js';

export const eventName = 'playerLeave';

function handlePlayerLeave(event) {
    playerDataManager.handlePlayerLeave(event.playerId);
    playerCache.removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;