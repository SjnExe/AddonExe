import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { soundTeleport } from '@core/utils/constants.js';
import { playSound } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { startTeleportWarmup } from '@core/utils/teleportLogic.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorder/manager.js';
import {
  findSafeLocation,
  isSafeTeleportColumn,
  saveLastLocation,
  teleportPlayerWithTransition,
  unsafeTeleportBlocks,
} from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

const topCommand: CustomCommand = {
  name: 'top',
  description: 'Teleports you to the highest safe block above your current position.',
  category: 'Transportation',
  permissionNode: 'cmd.top.builder',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const dim = executor.dimension;
    const x = Math.floor(executor.location.x);
    const z = Math.floor(executor.location.z);

    let topY: number | undefined;
    if (dim.id === MinecraftDimensionTypes.Nether) {
      // Nether ceiling bedrock sits at Y=127; scan below the roof using a rolling 3-block window
      const minY = dim.heightRange?.min ?? 0;
      const startY = Math.min(125, (dim.heightRange?.max ?? 128) - 3);
      if (startY >= minY) {
        try {
          let head = dim.getBlock({ x, y: startY + 1, z });
          let feet = dim.getBlock({ x, y: startY, z });
          for (let y = startY; y >= minY; y--) {
            const ground = dim.getBlock({ x, y: y - 1, z });
            if (
              isDefined(ground) &&
              isDefined(feet) &&
              isDefined(head) &&
              !ground.isAir &&
              !ground.isLiquid &&
              !unsafeTeleportBlocks.has(ground.typeId) &&
              feet.isAir &&
              !feet.isLiquid &&
              !unsafeTeleportBlocks.has(feet.typeId) &&
              head.isAir &&
              !head.isLiquid &&
              !unsafeTeleportBlocks.has(head.typeId)
            ) {
              topY = y;
              break;
            }
            head = feet;
            feet = ground;
          }
        } catch {
          // Stop scan on unloaded chunk
        }
      }
    } else {
      try {
        const topBlock = dim.getTopmostBlock({ x, z });
        if (isDefined(topBlock) && !topBlock.isAir) {
          topY = topBlock.location.y + 1;
        }
      } catch {
        // Fallback scan below
      }

      if (topY === undefined) {
        const maxY = (dim.heightRange?.max ?? 320) - 2;
        const minY = dim.heightRange?.min ?? -64;
        for (let y = maxY; y >= minY; y--) {
          try {
            const b = dim.getBlock({ x, y, z });
            if (isDefined(b) && !b.isAir) {
              topY = y + 1;
              break;
            }
          } catch {
            break;
          }
        }
      }
    }

    if (topY === undefined) {
      sendMessage('§cCould not find a surface block above you.', executor);
      return;
    }

    const playerFloorY = Math.floor(executor.location.y);
    if (playerFloorY >= topY) {
      sendMessage('§eYou are already at the highest block.', executor);
      return;
    }

    const safeLoc = findSafeLocation(dim, { x: x + 0.5, y: topY, z: z + 0.5 });
    if (!isDefined(safeLoc) || Math.floor(safeLoc.y) <= playerFloorY) {
      sendMessage('§cNo safe surface block found above you.', executor);
      return;
    }
    if (!isWithinWorldBorder(safeLoc, dim.id) && !canBypassWorldBorder(executor)) {
      sendMessage('§cDestination is outside the active world border.', executor);
      return;
    }

    const warmupSeconds = Number(getConfig().homes?.teleportWarmupSeconds ?? 3);
    startTeleportWarmup(
      executor,
      warmupSeconds,
      () => {
        if (!executor.isValid) {
          return false;
        }
        if (!isWithinWorldBorder(safeLoc, dim.id) && !canBypassWorldBorder(executor)) {
          sendMessage('§cDestination is outside the active world border. Teleport cancelled.', executor);
          return false;
        }
        if (!isSafeTeleportColumn(dim, Math.floor(safeLoc.x), Math.floor(safeLoc.y), Math.floor(safeLoc.z))) {
          sendMessage('§cDestination is no longer safe. Teleport cancelled.', executor);
          return false;
        }
        saveLastLocation(executor, 'teleport');
        teleportPlayerWithTransition(executor, safeLoc, { dimension: dim });
        playSound(executor, soundTeleport);
        sendMessage(`§aTeleported to the surface (Y: ${Math.floor(safeLoc.y)}).`, executor);
        return true;
      },
      'the surface',
    );
  },
};

export default topCommand;
