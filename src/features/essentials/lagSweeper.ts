import { getConfig, onConfigUpdated } from '@core/config/configManager.js';
import {
  clearTrackedInterval,
  clearTrackedTimeout,
  setTrackedInterval,
  setTrackedTimeout,
} from '@core/utils/timerManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

export interface ClearLagConfig {
  enabled?: boolean;
  autoIntervalSeconds?: number;
  broadcastWarnings?: boolean;
  clearItems?: boolean;
  clearHostileMobs?: boolean;
  clearExperienceOrbs?: boolean;
  exemptValuableItems?: boolean;
}

const exemptItems = new Set<string>([
  MinecraftItemTypes.NetheriteIngot,
  MinecraftItemTypes.NetheriteSword,
  MinecraftItemTypes.NetheritePickaxe,
  MinecraftItemTypes.NetheriteAxe,
  MinecraftItemTypes.NetheriteShovel,
  MinecraftItemTypes.NetheriteHoe,
  MinecraftItemTypes.NetheriteHelmet,
  MinecraftItemTypes.NetheriteChestplate,
  MinecraftItemTypes.NetheriteLeggings,
  MinecraftItemTypes.NetheriteBoots,
  MinecraftItemTypes.Elytra,
  MinecraftItemTypes.TotemOfUndying,
]);

const exemptEntityTypes = new Set<string>([
  MinecraftEntityTypes.Player,
  MinecraftEntityTypes.Villager,
  MinecraftEntityTypes.VillagerV2,
  MinecraftEntityTypes.WanderingTrader,
  MinecraftEntityTypes.IronGolem,
  MinecraftEntityTypes.SnowGolem,
  MinecraftEntityTypes.Warden,
  MinecraftEntityTypes.Wither,
  MinecraftEntityTypes.EnderDragon,
  MinecraftEntityTypes.ElderGuardian,
  MinecraftEntityTypes.ArmorStand,
  MinecraftEntityTypes.Boat,
  MinecraftEntityTypes.ChestBoat,
  MinecraftEntityTypes.Minecart,
  MinecraftEntityTypes.ChestMinecart,
  MinecraftEntityTypes.HopperMinecart,
  MinecraftEntityTypes.TntMinecart,
  MinecraftEntityTypes.Npc,
]);

export interface ClearLagStats {
  items: number;
  hostileMobs: number;
  experienceOrbs: number;
  totalRemoved: number;
}

let pendingSweepTimer: number | undefined;

export function isPendingSweep(): boolean {
  return isDefined(pendingSweepTimer);
}

export function cancelPendingSweep(): boolean {
  if (isDefined(pendingSweepTimer)) {
    clearTrackedTimeout(pendingSweepTimer);
    pendingSweepTimer = undefined;
    return true;
  }
  return false;
}

export function queryWorldEntityCounts(): { items: number; hostile: number; passive: number; total: number } {
  let items = 0;
  let hostile = 0;
  let passive = 0;
  let total = 0;

  const dimensions = [
    mc.world.getDimension(MinecraftDimensionTypes.Overworld),
    mc.world.getDimension(MinecraftDimensionTypes.Nether),
    mc.world.getDimension(MinecraftDimensionTypes.TheEnd),
  ];

  for (const dim of dimensions) {
    if (!isDefined(dim)) {
      continue;
    }

    try {
      const entities = dim.getEntities();
      for (const ent of entities) {
        if (!ent.isValid) {
          continue;
        }
        total++;

        if (isDefined(ent.getComponent(EntityComponentTypes.Item))) {
          items++;
          continue;
        }

        const typeFam = ent.getComponent(EntityComponentTypes.TypeFamily);
        if (typeFam?.hasTypeFamily('monster')) {
          hostile++;
        } else if (typeFam?.hasTypeFamily('mob') || typeFam?.hasTypeFamily('animal')) {
          passive++;
        }
      }
    } catch {
      // Dimension query fallback
    }
  }

  return { items, hostile, passive, total };
}

export function executeClearLagSweep(options?: ClearLagConfig): ClearLagStats {
  const cfg = options ?? getConfig().clearLag;
  const clearItems = cfg?.clearItems !== false;
  const clearHostile = cfg?.clearHostileMobs === true;
  const clearXp = cfg?.clearExperienceOrbs !== false;
  const protectValuables = cfg?.exemptValuableItems !== false;

  let itemsRemoved = 0;
  let hostileRemoved = 0;
  let xpRemoved = 0;

  const dimensions = [
    mc.world.getDimension(MinecraftDimensionTypes.Overworld),
    mc.world.getDimension(MinecraftDimensionTypes.Nether),
    mc.world.getDimension(MinecraftDimensionTypes.TheEnd),
  ];

  for (const dim of dimensions) {
    if (!isDefined(dim)) {
      continue;
    }

    try {
      const entities = dim.getEntities();
      for (const ent of entities) {
        if (!ent.isValid) {
          continue;
        }

        // Always exempt essential & boss entities
        if (exemptEntityTypes.has(ent.typeId) || ent.typeId?.startsWith('exe:')) {
          continue;
        }

        // Never clear named mobs or NPCs
        if (isNonEmptyString(ent.nameTag)) {
          continue;
        }

        // Never clear tamed pets
        const tameable = ent.getComponent(EntityComponentTypes.Tameable);
        if (isDefined(tameable) && tameable.tamedToPlayerId) {
          continue;
        }

        // 1. Dropped Items
        const itemComp = ent.getComponent(EntityComponentTypes.Item);
        if (isDefined(itemComp)) {
          if (!clearItems) {
            continue;
          }

          if (protectValuables) {
            const stack = itemComp.itemStack;
            if (isDefined(stack)) {
              if (exemptItems.has(stack.typeId) || stack.typeId.includes('shulker_box')) {
                continue;
              }
            }
          }

          try {
            ent.remove();
            itemsRemoved++;
          } catch {
            // Ignore
          }
          continue;
        }

        // 2. Experience Orbs
        if (ent.typeId === (MinecraftEntityTypes.XpOrb as string)) {
          if (!clearXp) {
            continue;
          }
          try {
            ent.remove();
            xpRemoved++;
          } catch {
            // Ignore
          }
          continue;
        }

        // 3. Hostile Mobs (only if explicitly enabled)
        if (clearHostile) {
          const typeFam = ent.getComponent(EntityComponentTypes.TypeFamily);
          if (typeFam?.hasTypeFamily('monster')) {
            try {
              ent.remove();
              hostileRemoved++;
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Dimension query fallback
    }
  }

  return {
    items: itemsRemoved,
    hostileMobs: hostileRemoved,
    experienceOrbs: xpRemoved,
    totalRemoved: itemsRemoved + hostileRemoved + xpRemoved,
  };
}

export function startSweepCountdown(countdownSeconds = 30, onComplete?: (stats: ClearLagStats) => void): void {
  cancelPendingSweep();

  if (countdownSeconds <= 0) {
    const stats = executeClearLagSweep();
    onComplete?.(stats);
    return;
  }

  mc.world.sendMessage(`§e[ClearLag] §7Ground entities will be swept in §c${countdownSeconds}s§7!`);

  if (countdownSeconds > 10) {
    setTrackedTimeout(
      () => {
        if (isPendingSweep()) {
          mc.world.sendMessage('§e[ClearLag] §7Ground entities will be swept in §c10s§7!');
        }
      },
      (countdownSeconds - 10) * 20,
    );
  }

  if (countdownSeconds > 3) {
    setTrackedTimeout(
      () => {
        if (isPendingSweep()) {
          mc.world.sendMessage('§e[ClearLag] §7Ground entities will be swept in §c3s§7!');
        }
      },
      (countdownSeconds - 3) * 20,
    );
  }

  pendingSweepTimer = setTrackedTimeout(() => {
    pendingSweepTimer = undefined;
    const stats = executeClearLagSweep();
    mc.world.sendMessage(
      `§a[ClearLag] §7Sweep complete! Removed §e${stats.items}§7 items, §e${stats.experienceOrbs}§7 XP orbs, §e${stats.hostileMobs}§7 mobs.`,
    );
    onComplete?.(stats);
  }, countdownSeconds * 20);
}

let autoSweepIntervalId: number | undefined;
let configHookRegistered = false;

export function restartLagSweeper(): void {
  if (isDefined(autoSweepIntervalId)) {
    clearTrackedInterval(autoSweepIntervalId);
    autoSweepIntervalId = undefined;
  }

  if (!configHookRegistered) {
    configHookRegistered = true;
    onConfigUpdated(() => {
      restartLagSweeper();
    });
  }

  try {
    const cfg = getConfig().clearLag;
    if (!cfg?.enabled) {
      return;
    }

    const intervalSeconds = Math.max(60, Number(cfg.autoIntervalSeconds) || 600);
    autoSweepIntervalId = setTrackedInterval(() => {
      const currentCfg = getConfig().clearLag;
      if (!currentCfg?.enabled) {
        return;
      }
      const warningSeconds = currentCfg.broadcastWarnings !== false ? 30 : 0;
      startSweepCountdown(warningSeconds);
    }, intervalSeconds * 20);
  } catch {
    // Config not loaded yet or invalid
  }
}

export function initializeLagSweeper(): void {
  restartLagSweeper();
}
