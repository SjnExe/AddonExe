import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

const logBlockPattern = /(?:_log|_stem|_wood)$/;

export function isLogBlock(blockTypeId: string): boolean {
  return logBlockPattern.test(blockTypeId);
}

export function isAxeItem(itemTypeId?: string): boolean {
  return isDefined(itemTypeId) && itemTypeId.endsWith('_axe');
}

export interface TreeCapitatorOptions {
  enabled?: boolean;
  requireSneak?: boolean;
  maxLogs?: number;
  damageTool?: boolean;
}

export function handleTreeCapitator(
  player: mc.Player,
  block: mc.Block,
  brokenPermutationOrOptions?: mc.BlockPermutation | TreeCapitatorOptions,
  maybeOptions?: TreeCapitatorOptions,
): number {
  if (!player.isValid) {
    return 0;
  }

  const isPermutation = isDefined(brokenPermutationOrOptions) && 'type' in brokenPermutationOrOptions;
  const brokenPermutation = isPermutation ? (brokenPermutationOrOptions as mc.BlockPermutation) : undefined;
  const options = (isPermutation ? maybeOptions : (brokenPermutationOrOptions as TreeCapitatorOptions)) ?? undefined;

  const cfg = options ?? getConfig().survivalQoL?.treeCapitator;
  if (!cfg?.enabled) {
    return 0;
  }

  if (cfg.requireSneak !== false && !player.isSneaking) {
    return 0;
  }

  if (typeof player.getGameMode === 'function' && player.getGameMode() === mc.GameMode.Creative) {
    return 0;
  }

  const equippable = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  const mainHand = equippable?.getEquipment(EquipmentSlot.Mainhand);
  if (!isAxeItem(mainHand?.typeId)) {
    return 0;
  }

  const targetTypeId = brokenPermutation?.type?.id ?? block.typeId;
  if (!isLogBlock(targetTypeId)) {
    return 0;
  }

  const dimension = player.dimension;
  const maxLogs = Math.max(1, Math.min(128, Number(cfg.maxLogs ?? 64)));

  const visited = new Set<string>();
  const toBreak: mc.Vector3[] = [];
  const queue: mc.Vector3[] = [{ x: block.location.x, y: block.location.y, z: block.location.z }];

  const startKey = `${block.location.x},${block.location.y},${block.location.z}`;
  visited.add(startKey);

  while (queue.length > 0 && toBreak.length < maxLogs) {
    const current = queue.shift()!;
    toBreak.push(current);

    // Search adjacent connected blocks (upwards and sideways)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = 0; dy <= 1; dy++) {
          if (dx === 0 && dy === 0 && dz === 0) {
            continue;
          }

          const nx = current.x + dx;
          const ny = current.y + dy;
          const nz = current.z + dz;
          const key = `${nx},${ny},${nz}`;

          if (visited.has(key)) {
            continue;
          }
          visited.add(key);

          try {
            const neighbor = dimension.getBlock({ x: nx, y: ny, z: nz });
            if (isDefined(neighbor) && neighbor.typeId === targetTypeId) {
              queue.push({ x: nx, y: ny, z: nz });
            }
          } catch {
            // Out of bounds / unloaded
          }
        }
      }
    }
  }

  // Break the connected logs (skip the start block if it's already broken by the event)
  let brokenCount = 0;
  for (const pos of toBreak) {
    if (pos.x === block.location.x && pos.y === block.location.y && pos.z === block.location.z) {
      continue;
    }

    try {
      dimension.setBlockType(pos, MinecraftBlockTypes.Air);
      dimension.spawnItem(new mc.ItemStack(targetTypeId, 1), {
        x: pos.x + 0.5,
        y: pos.y + 0.5,
        z: pos.z + 0.5,
      });
      brokenCount++;
    } catch {
      // Ignore if block cannot be changed
    }
  }

  // Apply durability damage to held axe
  if (cfg.damageTool !== false && brokenCount > 0 && isDefined(mainHand)) {
    const durability = mainHand.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
    if (isDefined(durability)) {
      const newDamage = durability.damage + brokenCount;
      if (newDamage >= durability.maxDurability) {
        equippable?.setEquipment(EquipmentSlot.Mainhand, undefined);
        try {
          player.playSound('random.break');
        } catch {
          // Ignore
        }
      } else {
        durability.damage = newDamage;
        equippable?.setEquipment(EquipmentSlot.Mainhand, mainHand);
      }
    }
  }

  return brokenCount;
}
