import { getConfig } from '@core/config/configManager.js';
import { isLogBlock } from '@features/essentials/survival/treeCapitator.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

export function isLeafBlock(blockTypeId: string): boolean {
  return blockTypeId.includes('leaves');
}

export interface FastLeafDecayOptions {
  enabled?: boolean;
  decayRadius?: number;
}

export function handleFastLeafDecay(
  dimension: mc.Dimension,
  brokenBlockLocation: mc.Vector3,
  brokenBlockTypeId: string,
  options?: FastLeafDecayOptions,
): number {
  const cfg = options ?? getConfig().survivalQoL?.fastLeafDecay;
  if (!cfg?.enabled) {
    return 0;
  }

  if (!isLogBlock(brokenBlockTypeId)) {
    return 0;
  }

  const radius = Math.max(2, Math.min(6, Number(cfg.decayRadius ?? 4)));
  const bx = Math.floor(brokenBlockLocation.x);
  const by = Math.floor(brokenBlockLocation.y);
  const bz = Math.floor(brokenBlockLocation.z);

  const leavesToDecay: mc.Vector3[] = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -1; dy <= radius + 2; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const lx = bx + dx;
        const ly = by + dy;
        const lz = bz + dz;

        try {
          const block = dimension.getBlock({ x: lx, y: ly, z: lz });
          if (isDefined(block) && isLeafBlock(block.typeId)) {
            // Check if there is any log supporting this leaf within 4 blocks
            let hasSupportingLog = false;
            for (let sx = -4; sx <= 4 && !hasSupportingLog; sx++) {
              for (let sy = -4; sy <= 4 && !hasSupportingLog; sy++) {
                for (let sz = -4; sz <= 4 && !hasSupportingLog; sz++) {
                  const checkBlock = dimension.getBlock({ x: lx + sx, y: ly + sy, z: lz + sz });
                  if (isDefined(checkBlock) && isLogBlock(checkBlock.typeId)) {
                    hasSupportingLog = true;
                  }
                }
              }
            }

            if (!hasSupportingLog) {
              leavesToDecay.push({ x: lx, y: ly, z: lz });
            }
          }
        } catch {
          // Out of bounds / unloaded
        }
      }
    }
  }

  // Decay orphaned leaves with a staggered jitter
  for (let i = 0; i < leavesToDecay.length; i++) {
    const leaf = leavesToDecay[i]!;
    const delayTicks = 2 + (i % 8) * 2;

    const decayAction = () => {
      try {
        const cur = dimension.getBlock(leaf);
        if (isDefined(cur) && isLeafBlock(cur.typeId)) {
          dimension.setBlockType(leaf, MinecraftBlockTypes.Air);
        }
      } catch {
        // Ignore
      }
    };

    if (typeof mc.system?.runTimeout === 'function') {
      mc.system.runTimeout(decayAction, delayTicks);
    } else {
      decayAction();
    }
  }

  return leavesToDecay.length;
}
