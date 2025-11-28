import * as mc from '@minecraft/server';

import { getConfig } from '../configManager.js';
import { debugLog , errorLog } from '../logger.js';
import { getLockState } from '../playerDataManager.js';
import * as playerDataManager from '../playerDataManager.js';

export const eventName = 'playerDimensionChange';

function handlePlayerDimensionChange(event: mc.PlayerDimensionChangeAfterEvent) {
    const { player, toDimension, fromLocation, fromDimension } = event;
    const config = getConfig();

    let dimensionId: 'nether' | 'end' | undefined;
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
        const pData = playerDataManager.getOrCreatePlayer(player);
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
    } catch (e: unknown) {
        const stack = e instanceof Error ? e.stack : String(e);
        errorLog(`[DimensionLock] Failed to teleport player ${player.name} from locked dimension: ${stack}`);
    }
}

export default handlePlayerDimensionChange;
