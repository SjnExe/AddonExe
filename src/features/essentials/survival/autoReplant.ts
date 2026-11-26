import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

const cropMaxAges: Record<
  string,
  { stateKey: 'growth' | 'age'; maxAge: number; soilType: string; seedItemType: string }
> = {
  [MinecraftBlockTypes.Wheat as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
    seedItemType: MinecraftItemTypes.WheatSeeds as string,
  },
  [MinecraftBlockTypes.Carrots as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
    seedItemType: MinecraftItemTypes.Carrot as string,
  },
  [MinecraftBlockTypes.Potatoes as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
    seedItemType: MinecraftItemTypes.Potato as string,
  },
  [MinecraftBlockTypes.Beetroot as string]: {
    stateKey: 'growth',
    maxAge: 7,
    soilType: MinecraftBlockTypes.Farmland as string,
    seedItemType: MinecraftItemTypes.BeetrootSeeds as string,
  },
  [MinecraftBlockTypes.NetherWart as string]: {
    stateKey: 'age',
    maxAge: 3,
    soilType: MinecraftBlockTypes.SoulSand as string,
    seedItemType: MinecraftItemTypes.NetherWart as string,
  },
};

/**
 * Checks whether a block permutation represents a fully mature crop.
 *
 * @param permutation Broken or inspected crop block permutation.
 * @returns True if the block is a tracked crop at its maximum growth/age state.
 */
export function isMatureCropPermutation(permutation: mc.BlockPermutation): boolean {
  const cropInfo = cropMaxAges[permutation.type.id];
  if (!isDefined(cropInfo)) {
    return false;
  }
  try {
    const currentAge = permutation.getState(cropInfo.stateKey);
    return typeof currentAge === 'number' && currentAge >= cropInfo.maxAge;
  } catch {
    return false;
  }
}

function consumeOneSeed(player: mc.Player, dimension: mc.Dimension, loc: mc.Vector3, seedItemType: string): boolean {
  if (player.isValid && player.getGameMode() === mc.GameMode.Creative) {
    return true;
  }
  if (player.isValid) {
    const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const container = inv?.container;
    if (isDefined(container)) {
      for (let i = 0; i < container.size; i++) {
        const stack = container.getItem(i);
        if (stack?.typeId === seedItemType && stack.amount >= 1) {
          if (stack.amount === 1) {
            container.setItem(i, undefined);
          } else {
            stack.amount -= 1;
            container.setItem(i, stack);
          }
          return true;
        }
      }
    }
  }
  try {
    const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
    for (const ent of dimension.getEntities({ location: center, maxDistance: 2.0 })) {
      if (!ent.isValid) {
        continue;
      }
      const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
      const stack = itemComp?.itemStack;
      if (stack?.typeId === seedItemType && stack.amount >= 1) {
        if (stack.amount === 1) {
          ent.remove();
        } else {
          const dropLoc = { ...ent.location };
          const remaining = stack.clone();
          remaining.amount = stack.amount - 1;
          ent.remove();
          dimension.spawnItem(remaining, dropLoc);
        }
        return true;
      }
    }
  } catch {
    // Ignore entity lookup failures
  }
  return false;
}

export function isCropBlock(blockTypeId: string): boolean {
  return isDefined(cropMaxAges[blockTypeId]);
}

export interface AutoReplantOptions {
  enabled?: boolean;
}

/**
 * Replants a mature crop on the next tick when a matching seed/crop item is available.
 *
 * @param player Player breaking the crop.
 * @param block Broken crop block.
 * @param brokenPermutationOrOptions Broken block permutation or options override.
 * @param maybeOptions Optional auto-replant configuration overrides.
 * @returns True if a replant was scheduled.
 */
export function handleAutoReplant(
  player: mc.Player,
  block: mc.Block,
  brokenPermutationOrOptions?: mc.BlockPermutation | AutoReplantOptions,
  maybeOptions?: AutoReplantOptions,
): boolean {
  if (!player.isValid) {
    return false;
  }

  const isPermutation = isDefined(brokenPermutationOrOptions) && 'type' in brokenPermutationOrOptions;
  const brokenPermutation = isPermutation ? (brokenPermutationOrOptions as mc.BlockPermutation) : undefined;
  const options = (isPermutation ? maybeOptions : (brokenPermutationOrOptions as AutoReplantOptions)) ?? undefined;

  const cfg = options ?? getConfig().survivalQoL?.autoReplant;
  if (!cfg?.enabled) {
    return false;
  }

  const permutation = brokenPermutation ?? block.permutation;
  const cropTypeId = permutation?.type?.id ?? block.typeId;
  const cropInfo = cropMaxAges[cropTypeId];
  if (!isDefined(cropInfo)) {
    return false;
  }

  try {
    const currentState = permutation.getState(cropInfo.stateKey);
    if (typeof currentState !== 'number' || currentState < cropInfo.maxAge) {
      return false;
    }
  } catch {
    return false;
  }

  const dimension = player.dimension;
  const loc = { x: block.location.x, y: block.location.y, z: block.location.z };

  // Run on next tick after the block break event finishes dropping items
  const scheduleReplant = () => {
    try {
      const soil = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
      if (!isDefined(soil) || soil.typeId !== cropInfo.soilType) {
        return;
      }

      const current = dimension.getBlock(loc);
      if (isDefined(current) && (current.isAir || current.typeId === MinecraftBlockTypes.Air)) {
        if (consumeOneSeed(player, dimension, loc, cropInfo.seedItemType)) {
          dimension.setBlockType(loc, cropTypeId);
        }
      }
    } catch {
      // Ignore
    }
  };

  if (typeof mc.system?.runTimeout === 'function') {
    mc.system.runTimeout(scheduleReplant, 1);
  } else if (typeof mc.system?.run === 'function') {
    mc.system.run(scheduleReplant);
  }

  return true;
}
