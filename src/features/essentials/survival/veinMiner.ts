import { getConfig } from '@core/config/configManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftEnchantmentTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

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
  preventToolBreak?: boolean;
  silkTouchEnabled?: boolean;
  fortuneMultiplier?: boolean;
  dropExperience?: boolean;
}

interface OreDropRule {
  dropItemId: string;
  minDrop: number;
  maxDrop: number;
  affectedByFortune: boolean;
  minXp: number;
  maxXp: number;
}

const oreDropTable: Record<string, OreDropRule> = {
  [MinecraftBlockTypes.CoalOre as string]: {
    dropItemId: MinecraftItemTypes.Coal,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 2,
  },
  [MinecraftBlockTypes.DeepslateCoalOre as string]: {
    dropItemId: MinecraftItemTypes.Coal,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 2,
  },
  [MinecraftBlockTypes.IronOre as string]: {
    dropItemId: MinecraftItemTypes.RawIron,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 0,
  },
  [MinecraftBlockTypes.DeepslateIronOre as string]: {
    dropItemId: MinecraftItemTypes.RawIron,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 0,
  },
  [MinecraftBlockTypes.CopperOre as string]: {
    dropItemId: MinecraftItemTypes.RawCopper,
    minDrop: 2,
    maxDrop: 5,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 0,
  },
  [MinecraftBlockTypes.DeepslateCopperOre as string]: {
    dropItemId: MinecraftItemTypes.RawCopper,
    minDrop: 2,
    maxDrop: 5,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 0,
  },
  [MinecraftBlockTypes.GoldOre as string]: {
    dropItemId: MinecraftItemTypes.RawGold,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 0,
  },
  [MinecraftBlockTypes.DeepslateGoldOre as string]: {
    dropItemId: MinecraftItemTypes.RawGold,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 0,
  },
  [MinecraftBlockTypes.NetherGoldOre as string]: {
    dropItemId: MinecraftItemTypes.GoldNugget,
    minDrop: 2,
    maxDrop: 6,
    affectedByFortune: true,
    minXp: 0,
    maxXp: 1,
  },
  [MinecraftBlockTypes.RedstoneOre as string]: {
    dropItemId: MinecraftItemTypes.Redstone,
    minDrop: 4,
    maxDrop: 5,
    affectedByFortune: true,
    minXp: 1,
    maxXp: 5,
  },
  [MinecraftBlockTypes.LitRedstoneOre as string]: {
    dropItemId: MinecraftItemTypes.Redstone,
    minDrop: 4,
    maxDrop: 5,
    affectedByFortune: true,
    minXp: 1,
    maxXp: 5,
  },
  [MinecraftBlockTypes.DeepslateRedstoneOre as string]: {
    dropItemId: MinecraftItemTypes.Redstone,
    minDrop: 4,
    maxDrop: 5,
    affectedByFortune: true,
    minXp: 1,
    maxXp: 5,
  },
  [MinecraftBlockTypes.LitDeepslateRedstoneOre as string]: {
    dropItemId: MinecraftItemTypes.Redstone,
    minDrop: 4,
    maxDrop: 5,
    affectedByFortune: true,
    minXp: 1,
    maxXp: 5,
  },
  [MinecraftBlockTypes.LapisOre as string]: {
    dropItemId: MinecraftItemTypes.LapisLazuli,
    minDrop: 4,
    maxDrop: 9,
    affectedByFortune: true,
    minXp: 2,
    maxXp: 5,
  },
  [MinecraftBlockTypes.DeepslateLapisOre as string]: {
    dropItemId: MinecraftItemTypes.LapisLazuli,
    minDrop: 4,
    maxDrop: 9,
    affectedByFortune: true,
    minXp: 2,
    maxXp: 5,
  },
  [MinecraftBlockTypes.DiamondOre as string]: {
    dropItemId: MinecraftItemTypes.Diamond,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 3,
    maxXp: 7,
  },
  [MinecraftBlockTypes.DeepslateDiamondOre as string]: {
    dropItemId: MinecraftItemTypes.Diamond,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 3,
    maxXp: 7,
  },
  [MinecraftBlockTypes.EmeraldOre as string]: {
    dropItemId: MinecraftItemTypes.Emerald,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 3,
    maxXp: 7,
  },
  [MinecraftBlockTypes.DeepslateEmeraldOre as string]: {
    dropItemId: MinecraftItemTypes.Emerald,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 3,
    maxXp: 7,
  },
  [MinecraftBlockTypes.QuartzOre as string]: {
    dropItemId: MinecraftItemTypes.Quartz,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: true,
    minXp: 2,
    maxXp: 5,
  },
  [MinecraftBlockTypes.AncientDebris as string]: {
    dropItemId: MinecraftItemTypes.AncientDebris,
    minDrop: 1,
    maxDrop: 1,
    affectedByFortune: false,
    minXp: 0,
    maxXp: 0,
  },
};

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

  const durability = mainHand?.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
  const preventBreak = cfg.preventToolBreak !== false;

  // Strict anti-exploit check: If remaining durability is at or below 1, refuse to chain-mine!
  if (cfg.damageTool !== false && isDefined(durability) && preventBreak) {
    const remaining = durability.maxDurability - durability.damage;
    if (remaining <= 1) {
      try {
        player.onScreenDisplay?.setActionBar('§e[AddonExe] Tool durability too low for VeinMiner (1 durability left).');
      } catch {
        // Ignore
      }
      return 0;
    }
  }

  const enchantComp = mainHand?.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
  const unbreakingLevel = enchantComp?.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level ?? 0;

  const hasSilkTouch =
    cfg.silkTouchEnabled !== false &&
    isDefined(enchantComp) &&
    (enchantComp.hasEnchantment(MinecraftEnchantmentTypes.SilkTouch) ||
      isDefined(enchantComp.getEnchantment(MinecraftEnchantmentTypes.SilkTouch)));

  const fortuneLevel =
    cfg.fortuneMultiplier !== false && isDefined(enchantComp)
      ? (enchantComp.getEnchantment(MinecraftEnchantmentTypes.Fortune)?.level ?? 0)
      : 0;

  const dimension = player.dimension;
  const maxOres = Math.max(1, Math.min(64, Number(cfg.maxOres ?? 32)));

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

  let simulatedDamage = 0;
  let reachedSafetyLimit = false;

  let head = 0;
  while (head < queue.length && toBreak.length < maxOres) {
    const current = queue[head++]!;
    toBreak.push(current);

    // Skip durability roll for the first block (it is already broken by the vanilla event)
    if (toBreak.length > 1) {
      const consumesDurability = unbreakingLevel <= 0 || Math.random() < 1 / (unbreakingLevel + 1);
      const candidateDamage = simulatedDamage + (consumesDurability ? 1 : 0);

      if (candidateDamage > maxSafeDamage) {
        reachedSafetyLimit = true;
        break; // Stop collecting ores — tool durability budget reached!
      }

      if (consumesDurability) {
        simulatedDamage = candidateDamage;
      }
    }

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

  if (brokenCount <= 0) {
    return 0;
  }

  // Calculate loot drops with Silk Touch and Fortune support
  let dropItemId = targetTypeId;
  let totalDropAmount = 0;
  let totalExperience = 0;

  const dropRule = oreDropTable[targetTypeId];
  if (hasSilkTouch || !isDefined(dropRule)) {
    // With Silk Touch (or unknown ore), drop the original block 1:1, no XP
    dropItemId = targetTypeId;
    totalDropAmount = brokenCount;
  } else {
    dropItemId = dropRule.dropItemId;
    for (let i = 0; i < brokenCount; i++) {
      // Base drop count per ore block
      let count =
        dropRule.minDrop === dropRule.maxDrop
          ? dropRule.minDrop
          : Math.floor(Math.random() * (dropRule.maxDrop - dropRule.minDrop + 1)) + dropRule.minDrop;

      // Vanilla Fortune drop multiplier calculation
      if (dropRule.affectedByFortune && fortuneLevel > 0) {
        // Discrete uniform [0, fortuneLevel + 1]: if roll > 1, multiplier = roll
        const roll = Math.floor(Math.random() * (fortuneLevel + 2));
        if (roll > 1) {
          count *= roll;
        }
      }
      totalDropAmount += count;

      // Vanilla XP calculation
      if (dropRule.maxXp > 0) {
        const xp = Math.floor(Math.random() * (dropRule.maxXp - dropRule.minXp + 1)) + dropRule.minXp;
        totalExperience += xp;
      }
    }
  }

  // Spawn consolidated item drop stacks at the mined block location to avoid entity explosion / physics lag
  if (totalDropAmount > 0) {
    const dropLocation = {
      x: block.location.x + 0.5,
      y: block.location.y + 0.5,
      z: block.location.z + 0.5,
    };
    let remaining = totalDropAmount;
    while (remaining > 0) {
      const stackCount = Math.min(64, remaining);
      try {
        dimension.spawnItem(new mc.ItemStack(dropItemId, stackCount), dropLocation);
      } catch {
        // Ignore if unable to spawn item
      }
      remaining -= stackCount;
    }
  }

  // Grant vanilla XP directly without spawning laggy orb entities
  if (cfg.dropExperience !== false && totalExperience > 0) {
    try {
      if (typeof player.addExperience === 'function') {
        player.addExperience(totalExperience);
      }
    } catch {
      // Ignore
    }
  }

  // Apply durability damage to held pickaxe with zero-exploit guarantee
  if (cfg.damageTool !== false && isDefined(mainHand) && isDefined(durability)) {
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
        player.onScreenDisplay?.setActionBar('§e[AddonExe] Pickaxe saved from breaking (1 durability left).');
      } catch {
        // Ignore
      }
    }
  }

  return brokenCount;
}
