import { getConfig } from '@core/config/configManager.js';
import { isLeafBlock } from '@features/essentials/survival/fastLeafDecay.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from '@minecraft/vanilla-data';

const logBlockPattern = /(?:_log|_stem|_wood)$/;

export function isLogBlock(blockTypeId: string): boolean {
  return logBlockPattern.test(blockTypeId);
}

export function isNaturalLogBlock(blockTypeId: string): boolean {
  if (blockTypeId.includes('stripped_')) {
    return false;
  }
  if (blockTypeId.endsWith('_wood') || blockTypeId.endsWith('_hyphae')) {
    return false;
  }
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
  preventToolBreak?: boolean;
  ignoreStrippedLogs?: boolean;
  requireLeaves?: boolean;
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

  // Protect player builds: ignore stripped logs and 6-sided bark wood by default
  if (cfg.ignoreStrippedLogs !== false && !isNaturalLogBlock(targetTypeId)) {
    return 0;
  }

  if (!isLogBlock(targetTypeId)) {
    return 0;
  }

  const durability = mainHand?.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
  const preventBreak = cfg.preventToolBreak !== false;

  // Strict anti-exploit check: If remaining durability is at or below 1, refuse to chain-chop!
  if (cfg.damageTool !== false && isDefined(durability) && preventBreak) {
    const remaining = durability.maxDurability - durability.damage;
    if (remaining <= 1) {
      try {
        player.onScreenDisplay?.setActionBar(
          '§e[AddonExe] Tool durability too low for TreeCapitator (1 durability left).',
        );
      } catch {
        // Ignore
      }
      return 0;
    }
  }

  const enchantComp = mainHand?.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
  const unbreakingLevel = enchantComp?.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level ?? 0;

  const dimension = player.dimension;
  const maxLogs = Math.max(1, Math.min(128, Number(cfg.maxLogs ?? 64)));

  // Maximum damage the tool can safely take before reaching the 1-durability limit
  const maxSafeDamage =
    cfg.damageTool !== false && isDefined(durability) && preventBreak
      ? Math.max(0, durability.maxDurability - durability.damage - 1)
      : Infinity;

  const visited = new Set<string>();
  const toBreak: mc.Vector3[] = [];
  const queue: mc.Vector3[] = [{ x: block.location.x, y: block.location.y, z: block.location.z }];

  const startKey = `${block.location.x},${block.location.y},${block.location.z}`;
  visited.add(startKey);

  let maxLogY = block.location.y;
  let topLogPos: mc.Vector3 = { x: block.location.x, y: block.location.y, z: block.location.z };
  let simulatedDamage = 0;
  let reachedSafetyLimit = false;

  let head = 0;
  while (head < queue.length && toBreak.length < maxLogs) {
    const current = queue[head++]!;
    toBreak.push(current);
    if (current.y > maxLogY) {
      maxLogY = current.y;
      topLogPos = current;
    }

    // Skip durability roll for the first block (it is already broken by the vanilla event)
    if (toBreak.length > 1) {
      const consumesDurability = unbreakingLevel <= 0 || Math.random() < 1 / (unbreakingLevel + 1);
      const candidateDamage = simulatedDamage + (consumesDurability ? 1 : 0);

      if (candidateDamage > maxSafeDamage) {
        reachedSafetyLimit = true;
        break; // Stop collecting blocks — tool durability budget reached!
      }

      if (consumesDurability) {
        simulatedDamage = candidateDamage;
      }
    }

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

          // Prevent runaway horizontal scans across player builds
          if (Math.abs(nx - block.location.x) > 6 || Math.abs(nz - block.location.z) > 6) {
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
            // Out of bounds / unloaded
          }
        }
      }
    }
  }

  // Canopy Leaf Verification: natural trees must have leaves at the top.
  // If no leaves are found near the tree canopy, treat it as a player build and bail out.
  if (cfg.requireLeaves !== false) {
    let hasCanopyLeaves = false;
    for (let dx = -2; dx <= 2 && !hasCanopyLeaves; dx++) {
      for (let dz = -2; dz <= 2 && !hasCanopyLeaves; dz++) {
        for (let dy = -1; dy <= 3 && !hasCanopyLeaves; dy++) {
          try {
            const checkBlock = dimension.getBlock({
              x: topLogPos.x + dx,
              y: topLogPos.y + dy,
              z: topLogPos.z + dz,
            });
            if (isDefined(checkBlock) && isLeafBlock(checkBlock.typeId)) {
              hasCanopyLeaves = true;
            }
          } catch {
            // Ignore out of bounds
          }
        }
      }
    }

    if (!hasCanopyLeaves) {
      return 0;
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
      brokenCount++;
    } catch {
      // Ignore if block cannot be changed
    }
  }

  // Spawn consolidated item drop stacks at the trunk base to minimize entity lag on big servers
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

  // Apply durability damage to held axe with zero-exploit guarantee
  if (cfg.damageTool !== false && brokenCount > 0 && isDefined(mainHand) && isDefined(durability)) {
    // Anti-exploit: Any execution that breaks extra blocks MUST consume at least 1 durability point!
    const actualDamage = Math.max(1, simulatedDamage);
    const newDamage = durability.damage + actualDamage;

    if (newDamage >= durability.maxDurability) {
      if (!preventBreak) {
        equippable?.setEquipment(EquipmentSlot.Mainhand, undefined);
        try {
          player.playSound('random.break');
        } catch {
          // Ignore
        }
      } else {
        // Clamped at 1 durability remaining
        durability.damage = Math.max(0, durability.maxDurability - 1);
        equippable?.setEquipment(EquipmentSlot.Mainhand, mainHand);
      }
    } else {
      durability.damage = newDamage;
      equippable?.setEquipment(EquipmentSlot.Mainhand, mainHand);
    }

    if (reachedSafetyLimit && preventBreak) {
      try {
        player.onScreenDisplay?.setActionBar('§e[AddonExe] Axe saved from breaking (1 durability left).');
      } catch {
        // Ignore
      }
    }
  }

  return brokenCount;
}
