import { getConfig } from '@core/config/configManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export function isDoorBlock(blockTypeId?: string): boolean {
  if (!isNonEmptyString(blockTypeId)) {
    return false;
  }
  return blockTypeId.includes('door') && !blockTypeId.includes('trapdoor');
}

export interface DoubleDoorsOptions {
  enabled?: boolean;
}

export function handleDoubleDoorInteract(player: mc.Player, block: mc.Block, options?: DoubleDoorsOptions): boolean {
  if (!player.isValid) {
    return false;
  }

  const cfg = options ?? getConfig().survivalQoL?.doubleDoors;
  if (!cfg?.enabled) {
    return false;
  }

  if (!isDoorBlock(block.typeId)) {
    return false;
  }

  const dimension = player.dimension;
  let currentOpen = false;

  try {
    const rawOpen = block.permutation.getState('open_bit');
    currentOpen = Boolean(rawOpen);
  } catch {
    return false;
  }

  const newOpenState = !currentOpen;
  const targetTypeId = block.typeId;
  const bx = block.location.x;
  const by = block.location.y;
  const bz = block.location.z;

  const horizontalOffsets = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];

  let synced = false;

  for (const offset of horizontalOffsets) {
    try {
      const neighbor = dimension.getBlock({ x: bx + offset.x, y: by, z: bz + offset.z });
      if (isDefined(neighbor) && neighbor.typeId === targetTypeId) {
        const neighborOpen = neighbor.permutation.getState('open_bit');
        if (typeof neighborOpen === 'boolean' && neighborOpen !== newOpenState) {
          const newPerm = neighbor.permutation.withState('open_bit', newOpenState);
          neighbor.setPermutation(newPerm);
          synced = true;

          // Check if there is an upper or lower door half to update in tandem
          const upperHalf = dimension.getBlock({ x: bx + offset.x, y: by + 1, z: bz + offset.z });
          if (isDefined(upperHalf) && upperHalf.typeId === targetTypeId) {
            try {
              upperHalf.setPermutation(upperHalf.permutation.withState('open_bit', newOpenState));
            } catch {
              // Ignore
            }
          }
          const lowerHalf = dimension.getBlock({ x: bx + offset.x, y: by - 1, z: bz + offset.z });
          if (isDefined(lowerHalf) && lowerHalf.typeId === targetTypeId) {
            try {
              lowerHalf.setPermutation(lowerHalf.permutation.withState('open_bit', newOpenState));
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return synced;
}
