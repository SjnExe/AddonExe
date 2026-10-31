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

  const foundLogs: mc.Vector3[] = [];
  const candidateLeaves: mc.Vector3[] = [];

  // Single-pass scan of the canopy bounding box (avoids tens of thousands of getBlock calls)
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -1; dy <= radius + 2; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const lx = bx + dx;
        const ly = by + dy;
        const lz = bz + dz;

        try {
          const block = dimension.getBlock({ x: lx, y: ly, z: lz });
          if (!isDefined(block)) {
            continue;
          }
          if (isLogBlock(block.typeId)) {
            foundLogs.push({ x: lx, y: ly, z: lz });
          } else if (isLeafBlock(block.typeId)) {
            candidateLeaves.push({ x: lx, y: ly, z: lz });
          }
        } catch {
          // Out of bounds / unloaded
        }
      }
    }
  }

  // Identify orphaned leaves in memory without further getBlock calls
  const leavesToDecay: mc.Vector3[] = [];
  for (const leaf of candidateLeaves) {
    let hasSupportingLog = false;
    for (const log of foundLogs) {
      if (Math.abs(leaf.x - log.x) <= 4 && Math.abs(leaf.y - log.y) <= 4 && Math.abs(leaf.z - log.z) <= 4) {
        hasSupportingLog = true;
        break;
      }
    }
    if (!hasSupportingLog) {
      leavesToDecay.push(leaf);
    }
  }

  // Decay orphaned leaves in staggered batches across ticks to prevent engine spikes
  for (let i = 0; i < leavesToDecay.length; i++) {
    const leaf = leavesToDecay[i]!;
    const delayTicks = 1 + Math.floor(i / 6) * 2; // Batches of 6 leaves every 2 ticks

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
