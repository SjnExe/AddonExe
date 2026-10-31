import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

export function isOreBlock(blockTypeId: string): boolean {
  return blockTypeId.includes('_ore') || blockTypeId === (MinecraftBlockTypes.AncientDebris as string);
}

export function isPickaxeItem(itemTypeId?: string): boolean {
  return isDefined(itemTypeId) && itemTypeId.endsWith('_pickaxe');
}

export interface VeinMinerOptions {
  enabled?: boolean;
  requireSneak?: boolean;
  maxOres?: number;
  damageTool?: boolean;
}

export function handleVeinMiner(
  player: mc.Player,
  block: mc.Block,
  brokenPermutationOrOptions?: mc.BlockPermutation | VeinMinerOptions,
  maybeOptions?: VeinMinerOptions,
): number {
  if (!player.isValid) {
    return 0;
  }

  const isPermutation = isDefined(brokenPermutationOrOptions) && 'type' in brokenPermutationOrOptions;
  const brokenPermutation = isPermutation ? (brokenPermutationOrOptions as mc.BlockPermutation) : undefined;
  const options = (isPermutation ? maybeOptions : (brokenPermutationOrOptions as VeinMinerOptions)) ?? undefined;

  const cfg = options ?? getConfig().survivalQoL?.veinMiner;
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
  if (!isPickaxeItem(mainHand?.typeId)) {
    return 0;
  }

  const targetTypeId = brokenPermutation?.type?.id ?? block.typeId;
  if (!isOreBlock(targetTypeId)) {
    return 0;
  }

  const dimension = player.dimension;
  const maxOres = Math.max(1, Math.min(64, Number(cfg.maxOres ?? 32)));

  const visited = new Set<string>();
  const toBreak: mc.Vector3[] = [];
  const queue: mc.Vector3[] = [{ x: block.location.x, y: block.location.y, z: block.location.z }];

  const startKey = `${block.location.x},${block.location.y},${block.location.z}`;
  visited.add(startKey);

  let head = 0;
  while (head < queue.length && toBreak.length < maxOres) {
    const current = queue[head++]!;
    toBreak.push(current);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) {
            continue;
          }

          const nx = current.x + dx;
          const ny = current.y + dy;
          const nz = current.z + dz;

          // Prevent runaway scans across huge mining areas
          if (
            Math.abs(nx - block.location.x) > 8 ||
            Math.abs(ny - block.location.y) > 8 ||
            Math.abs(nz - block.location.z) > 8
          ) {
            continue;
          }

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
            // Out of bounds
          }
        }
      }
    }
  }

  let brokenCount = 0;
  for (const pos of toBreak) {
    if (pos.x === block.location.x && pos.y === block.location.y && pos.z === block.location.z) {
      continue;
    }

    try {
      dimension.setBlockType(pos, MinecraftBlockTypes.Air);
      brokenCount++;
    } catch {
      // Ignore
    }
  }

  // Spawn consolidated item drop stacks at the mined block location to avoid entity explosion / physics lag
  if (brokenCount > 0) {
    const dropLocation = {
      x: block.location.x + 0.5,
      y: block.location.y + 0.5,
      z: block.location.z + 0.5,
    };
    let remaining = brokenCount;
    while (remaining > 0) {
      const stackCount = Math.min(64, remaining);
      try {
        dimension.spawnItem(new mc.ItemStack(targetTypeId, stackCount), dropLocation);
      } catch {
        // Ignore if unable to spawn item
      }
      remaining -= stackCount;
    }
  }

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
