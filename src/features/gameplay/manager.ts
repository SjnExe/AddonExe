import { getGameplayConfig } from '@core/config/configurations.js';
import { errorLog } from '@core/utils/logger.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityDamageCause, world } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEffectTypes, MinecraftEntityTypes } from '@minecraft/vanilla-data';

let isInitialized = false;
let managedKeepInventory = false;

/**
 * Handles incoming entity damage before evaluation, canceling fall damage if configured.
 *
 * @param event Damage event dispatched prior to damage application.
 */
export function handleGameplayHurt(event: mc.EntityHurtBeforeEvent): void {
  const config = getGameplayConfig();
  if (!config.preventFallDamage) {
    return;
  }

  const { hurtEntity, damageSource } = event;
  if (!hurtEntity.isValid || hurtEntity.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  if (damageSource.cause === EntityDamageCause.fall) {
    event.cancel = true;
  }
}

/**
 * Handles entity hurt aftermath, scaling or canceling combat knockback if configured.
 *
 * @param event Damage event dispatched after damage application.
 */
export function handleGameplayHurtAfter(event: mc.EntityHurtAfterEvent): void {
  const config = getGameplayConfig();
  if (!config.customKnockback) {
    return;
  }

  const { hurtEntity, damageSource } = event;
  if (!hurtEntity.isValid || hurtEntity.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  const player = hurtEntity as mc.Player;

  // No knockback mode
  if (config.knockbackScale <= 0) {
    player.clearVelocity();
    return;
  }

  // Custom knockback multiplier
  if (config.knockbackScale !== 1.0) {
    const damaging = damageSource.damagingEntity;
    if (isDefined(damaging) && damaging.isValid) {
      const dx = player.location.x - damaging.location.x;
      const dz = player.location.z - damaging.location.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001) {
        const strength = 0.4 * config.knockbackScale;
        player.applyKnockback({ x: (dx / dist) * strength, z: (dz / dist) * strength }, strength);
      }
    }
  }
}

/** Synchronizes server gamerules with custom gameplay mechanics configuration. */
export function syncGameplayGamerules(): void {
  const config = getGameplayConfig();
  const desired = config.keepInventory;
  try {
    if (desired) {
      world.gameRules.keepInventory = true;
      managedKeepInventory = true;
    } else if (managedKeepInventory) {
      world.gameRules.keepInventory = false;
      managedKeepInventory = false;
    }
  } catch (error) {
    errorLog(`[Gameplay] Failed to synchronize keepInventory gamerule: ${String(error)}`);
  }
}

/**
 * Rescues players falling into the void by halting velocity and teleporting them to world spawn.
 *
 * @param player Target player falling into the void.
 */
export function rescuePlayerFromVoid(player: mc.Player): void {
  if (!player.isValid) {
    return;
  }

  try {
    player.clearVelocity();
    player.addEffect(MinecraftEffectTypes.SlowFalling, 60, { amplifier: 1, showParticles: false });

    const spawn = world.getDefaultSpawnLocation();
    const targetLoc = { x: spawn.x + 0.5, y: spawn.y + 1, z: spawn.z + 0.5 };
    const overworld = world.getDimension(MinecraftDimensionTypes.Overworld);
    player.teleport(targetLoc, { dimension: overworld });

    player.sendMessage('§e[Server] You were rescued from the void!');
  } catch (error) {
    errorLog(`[Gameplay] Failed to rescue player ${player.name} from void: ${String(error)}`);
  }
}

/** Initializes gameplay mechanics listeners, interval monitors, and gamerule synchronizers. */
export function initializeGameplayMechanics(): void {
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  syncGameplayGamerules();

  // Subscribe to hurt events
  world.beforeEvents.entityHurt.subscribe(handleGameplayHurt);
  world.afterEvents.entityHurt.subscribe(handleGameplayHurtAfter);

  // Void rescue monitoring interval (checks every 10 ticks = 0.5s)
  setTrackedInterval(() => {
    const config = getGameplayConfig();
    if (!config.voidRescue) {
      return;
    }

    for (const player of world.getAllPlayers()) {
      if (!player.isValid) {
        continue;
      }
      const y = player.location.y;
      // Optimization: Skip dimension query for players safely above the void
      if (y >= 0) {
        continue;
      }

      const dimId = player.dimension.id;
      const isVoid =
        (dimId === MinecraftDimensionTypes.Overworld && y < -64) ||
        (dimId !== MinecraftDimensionTypes.Overworld && y < 0);

      if (isVoid) {
        rescuePlayerFromVoid(player);
      }
    }
  }, 10);
}
