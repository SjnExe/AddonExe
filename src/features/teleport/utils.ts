import { getConfig } from '@core/config/configManager.js';
import { getCooldown, setCooldown } from '@core/data/cooldownManager.js';
import { setPlayerLastLocation } from '@core/data/playerDataManager.js';
import { errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { startTeleportWarmup } from '@core/utils/teleportLogic.js';
import { formatCooldown } from '@core/utils/time.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorderManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

export const unsafeTeleportBlocks = new Set<string>([
  MinecraftBlockTypes.Lava,
  MinecraftBlockTypes.FlowingLava,
  MinecraftBlockTypes.Fire,
  MinecraftBlockTypes.SoulFire,
  MinecraftBlockTypes.Magma,
  MinecraftBlockTypes.Cactus,
  MinecraftBlockTypes.Water,
  MinecraftBlockTypes.FlowingWater,
  MinecraftBlockTypes.SweetBerryBush,
  MinecraftBlockTypes.PowderSnow,
  MinecraftBlockTypes.Campfire,
  MinecraftBlockTypes.SoulCampfire,
  MinecraftBlockTypes.WitherRose,
  MinecraftBlockTypes.Web,
  MinecraftBlockTypes.PointedDripstone,
  MinecraftBlockTypes.Portal,
  MinecraftBlockTypes.EndPortal,
]);

interface Offset3D {
  dx: number;
  dy: number;
  dz: number;
  distSq: number;
}

const sortedSearchOffsets: Offset3D[] = (() => {
  const offsets: Offset3D[] = [];
  const radius = 3;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = -2; dy <= 2; dy++) {
        offsets.push({
          dx,
          dy,
          dz,
          distSq: dx * dx + dz * dz + dy * dy * 1.5,
        });
      }
    }
  }
  return offsets.toSorted((a, b) => a.distSq - b.distSq);
})();

/** Saves the player's current location as their "last location" for /back command. */
export function saveLastLocation(player: mc.Player, reason: 'death' | 'teleport' = 'teleport'): void {
  if (!isDefined(player) || !player.isValid) {
    return;
  }

  const backConfig = getConfig().back as
    { enabled?: boolean; saveOnDeath?: boolean; saveOnTeleport?: boolean } | undefined;
  if (!backConfig?.enabled) {
    return;
  }
  if (reason === 'death' && backConfig.saveOnDeath !== true) {
    return;
  }
  if (reason === 'teleport' && backConfig.saveOnTeleport !== true) {
    return;
  }

  try {
    setPlayerLastLocation(player.id, {
      x: player.location.x,
      y: player.location.y,
      z: player.location.z,
      dimensionId: player.dimension.id,
    });
  } catch {
    // Ignore if player disconnected during call
  }
}

/** Checks if a specific block column has safe solid ground and 2 breathable blocks above. */
export function isSafeTeleportColumn(
  dimension: mc.Dimension,
  x: number,
  y: number,
  z: number,
  rejectLeaves = false,
): boolean {
  try {
    const ground = dimension.getBlock({ x, y: y - 1, z });
    const feet = dimension.getBlock({ x, y, z });
    const head = dimension.getBlock({ x, y: y + 1, z });

    if (!isDefined(ground) || !isDefined(feet) || !isDefined(head)) {
      return false;
    }

    if (ground.isAir || ground.isLiquid || unsafeTeleportBlocks.has(ground.typeId)) {
      return false;
    }
    if (rejectLeaves && ground.typeId.includes('leaves')) {
      return false;
    }

    const isFeetSafe = feet.isAir && !feet.isLiquid && !unsafeTeleportBlocks.has(feet.typeId);
    const isHeadSafe = head.isAir && !head.isLiquid && !unsafeTeleportBlocks.has(head.typeId);

    return isFeetSafe && isHeadSafe;
  } catch {
    return false;
  }
}

/** Finds the nearest safe location to the target coordinates, checking (0, 0, 0) first. */
export function findSafeLocation(dimension: mc.Dimension, location: mc.Vector3): mc.Vector3 | undefined {
  const baseX = Math.floor(location.x);
  const baseY = Math.floor(location.y);
  const baseZ = Math.floor(location.z);

  for (const offset of sortedSearchOffsets) {
    const checkX = baseX + offset.dx;
    const checkY = baseY + offset.dy;
    const checkZ = baseZ + offset.dz;

    if (isSafeTeleportColumn(dimension, checkX, checkY, checkZ, false)) {
      return {
        x: checkX + 0.5,
        y: checkY,
        z: checkZ + 0.5,
      };
    }
  }
  return undefined;
}

export interface ExecuteTeleportParams {
  executor: mc.Player;
  location: mc.Vector3 & { dimensionId: string };
  destinationName: string;
  teleportType: string;
  warmupSeconds: number;
  cooldownSeconds: number;
  cooldownKey: string;
}

/**
 * Consolidates common teleport logic including cooldown check, world border check, warmup, dimension resolution, and
 * error logging.
 */
export function executeTeleport(params: ExecuteTeleportParams): void {
  const { executor, location, destinationName, teleportType, warmupSeconds, cooldownSeconds, cooldownKey } = params;

  const remainingCd = getCooldown(executor.id, cooldownKey);
  if (remainingCd > 0) {
    sendMessage(`§cYou must wait ${formatCooldown(remainingCd)} before using /${teleportType} again.`, executor);
    return;
  }

  if (!isWithinWorldBorder(location, location.dimensionId) && !canBypassWorldBorder(executor)) {
    sendMessage(
      `§cCannot teleport: ${teleportType} '${destinationName}' is outside the active world border.`,
      executor,
    );
    return;
  }

  const teleportLogic = () => {
    try {
      if (!executor.isValid) {
        return;
      }
      const dimension = mc.world.getDimension(location.dimensionId);
      if (!isDefined(dimension)) {
        sendMessage(`§cError: Dimension '${location.dimensionId}' not found.`, executor);
        return;
      }
      saveLastLocation(executor);
      executor.teleport(location, { dimension });
      sendMessage(`§aTeleported to ${teleportType} '${destinationName}'.`, executor);
      setCooldown(executor.id, cooldownKey, cooldownSeconds);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : String(error);
      sendMessage(`§cFailed to teleport. Error: ${message}`, executor);
      errorLog(`[/${teleportType}] Failed to teleport: ${stack}`);
    }
  };

  startTeleportWarmup(executor, warmupSeconds, teleportLogic, `${teleportType} '${destinationName}'`);
}
