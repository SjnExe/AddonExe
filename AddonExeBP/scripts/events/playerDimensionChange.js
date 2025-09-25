import { getConfig } from '../core/configManager.js';
import { getLockState } from '../core/playerDataManager.js';
import * as playerDataManager from '../core/playerDataManager.js';
import { debugLog } from '../core/logger.js';
import { errorLog } from '../core/errorLogger.js';

export const eventName = 'playerDimensionChange';

function handlePlayerDimensionChange(event) {
    const { player, toDimension, fromLocation, fromDimension } = event;
    const config = getConfig();

    let dimensionId;
    if (toDimension.id === 'minecraft:nether') {
        dimensionId = 'nether';
    } else if (toDimension.id === 'minecraft:the_end') {
        dimensionId = 'end';
    } else {
        return;
    }

    const isLocked = getLockState(dimensionId);
    if (!isLocked) {
        return;
    }

    if (config.dimensionLock?.allowAdminBypass) {
        const pData = playerDataManager.getPlayer(player.id);
        if (pData && pData.permissionLevel <= 1) {
            debugLog(`[DimensionLock] Allowing admin ${player.name} to enter locked ${dimensionId} dimension.`);
            return;
        }
    }

    try {
        const returnLocation = {
            x: fromLocation.x + 3,
            y: fromLocation.y,
            z: fromLocation.z + 3
        };
        player.teleport(returnLocation, { dimension: fromDimension });
        player.sendMessage(`§cThe ${dimensionId} dimension is currently locked.`);
    } catch (e) {
        errorLog(`[DimensionLock] Failed to teleport player ${player.name} from locked dimension: ${e.stack}`);
    }
}

export default handlePlayerDimensionChange;