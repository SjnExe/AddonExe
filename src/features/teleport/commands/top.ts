import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { soundTeleport } from '@core/utils/constants.js';
import { playSound } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { grantTeleportProtection } from '@core/utils/teleportLogic.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

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

    if (topY === undefined) {
      sendMessage('§cCould not find a surface block above you.', executor);
      return;
    }

    if (Math.floor(executor.location.y) >= topY) {
      sendMessage('§eYou are already at the highest block.', executor);
      return;
    }

    saveLastLocation(executor, 'teleport');
    executor.teleport({ x: x + 0.5, y: topY, z: z + 0.5 }, { dimension: dim });
    grantTeleportProtection(executor);
    playSound(executor, soundTeleport);
    sendMessage(`§aTeleported to the surface (Y: ${topY}).`, executor);
  },
};

export default topCommand;
