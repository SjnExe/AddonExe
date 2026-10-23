import { getConfig } from '@core/config/configManager.js';
import { getLockState } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

export const eventName = 'playerDimensionChange';

function handlePlayerDimensionChange(event: mc.PlayerDimensionChangeAfterEvent) {
  const { player, toDimension, fromLocation, fromDimension } = event;
  const config = getConfig();

  let dimensionId: 'nether' | 'end' | undefined;
  if (toDimension.id === MinecraftDimensionTypes.Nether) {
    dimensionId = 'nether';
  } else if (toDimension.id === MinecraftDimensionTypes.TheEnd) {
    dimensionId = 'end';
  } else {
    return;
  }

  const isLocked = getLockState(dimensionId);
  if (!isLocked) {
    return;
  }

  if (config.dimensionLock.allowAdminBypass) {
    if (hasPermission(player, 'group.admin')) {
      debugLog(`[DimensionLock] Allowing admin ${player.name} to enter locked ${dimensionId} dimension.`);
      return;
    }
  }

  try {
    const returnLocation = {
      x: fromLocation.x + 3,
      y: fromLocation.y,
      z: fromLocation.z + 3,
    };
    player.teleport(returnLocation, { dimension: fromDimension });
    player.sendMessage(`§cThe ${dimensionId} dimension is currently locked.`);
  } catch (error: unknown) {
    const stack = error instanceof Error ? error.stack : String(error);
    errorLog(`[DimensionLock] Failed to teleport player ${player.name} from locked dimension: ${stack}`);
  }
}

export default handlePlayerDimensionChange;
