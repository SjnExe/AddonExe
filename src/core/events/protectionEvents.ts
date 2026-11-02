import { getConfig } from '@core/config/configManager.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { frozenTag } from '@core/utils/constants.js';
import { hasTeleportProtection } from '@core/utils/teleportLogic.js';
import { handleWandBreakBlock, handleWandInteractBlock } from '@features/essentials/protection/zoneSelectionManager.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

export function canBypass(player: mc.Player): boolean {
  // Check if admin bypass is allowed globally or in spawn configuration
  const config = getConfig();

  if (config && config.spawnProtection && !config.spawnProtection.allowAdminBypass) {
    return false;
  }

  try {
    // Owner, Admin, Mod, or Builder / explicit bypass permission
    return hasPermission(player, 'group.mod') || hasPermission(player, 'bypass.spawnprotection');
  } catch {
    return false;
  }
}

export function handleBeforePlayerBreakBlock(event: mc.PlayerBreakBlockBeforeEvent) {
  const { player, block } = event;
  if (!isDefined(player) || !isDefined(block)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (hasTeleportProtection(player.id)) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — actions locked briefly.', 1500);
    });
    return;
  }
  if (handleWandBreakBlock(event)) {
    return;
  }

  const flags = getProtectionFlags(block.location, player.dimension.id);
  if (flags.preventBlockBreaking) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot break blocks here.', 2500);
      });
    }
  }
}

export function handleBeforePlayerPlaceBlock(event: mc.PlayerPlaceBlockBeforeEvent) {
  const { player, block } = event;
  if (!isDefined(player) || !isDefined(block)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (hasTeleportProtection(player.id)) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — actions locked briefly.', 1500);
    });
    return;
  }

  const flags = getProtectionFlags(block.location, player.dimension.id);
  if (flags.preventBlockPlacing) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot place blocks here.', 2500);
      });
    }
  }
}

export function handleBeforeExplosion(event: mc.ExplosionBeforeEvent) {
  const impactedBlocks = event.getImpactedBlocks();
  const loc = event.source?.location ?? (impactedBlocks.length > 0 ? impactedBlocks[0]?.location : undefined);
  if (!loc) {
    return;
  }
  const dimId = event.dimension.id;
  const isMobSource = isDefined(event.source) && event.source.typeId !== MinecraftEntityTypes.Player;
  const sourceFlags = getProtectionFlags(loc, dimId);

  if (sourceFlags.preventMobGriefing && isMobSource) {
    event.setImpactedBlocks([]);
    return;
  }

  if (sourceFlags.preventExplosions) {
    event.cancel = true;
    event.setImpactedBlocks([]);
    return;
  }

  if (impactedBlocks.length === 0) {
    return;
  }

  const allowedBlocks: mc.Block[] = [];
  for (const block of impactedBlocks) {
    if (!isDefined(block)) {
      continue;
    }
    const blockFlags = getProtectionFlags(block.location, dimId);
    if (!blockFlags.preventExplosions && (!blockFlags.preventMobGriefing || !isMobSource)) {
      allowedBlocks.push(block);
    }
  }
  if (allowedBlocks.length !== impactedBlocks.length) {
    event.setImpactedBlocks(allowedBlocks);
  }
}

export function handleBeforeItemUse(event: mc.ItemUseBeforeEvent) {
  const player = event.source;
  if (!(player instanceof mc.Player)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (hasTeleportProtection(player.id) && event.itemStack.typeId !== 'exe:panel') {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — item use locked briefly.', 1500);
    });
    return;
  }

  const flags = getProtectionFlags(player.location, player.dimension.id);
  const isFireStarter =
    event.itemStack.typeId === MinecraftItemTypes.FlintAndSteel ||
    event.itemStack.typeId === MinecraftItemTypes.FireCharge;

  if (isFireStarter && (flags.preventPvP || flags.preventBlockPlacing)) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot use fire starters here.', 2500);
      });
      return;
    }
  }

  if (flags.preventProjectileUsage) {
    // Basic list of items that shoot projectiles
    const projectileItems = [
      MinecraftItemTypes.Bow,
      MinecraftItemTypes.Crossbow,
      MinecraftItemTypes.Snowball,
      MinecraftItemTypes.EnderPearl,
      MinecraftItemTypes.Egg,
      MinecraftItemTypes.SplashPotion,
      MinecraftItemTypes.LingeringPotion,
      MinecraftItemTypes.ExperienceBottle,
      MinecraftItemTypes.Trident,
    ];

    if (projectileItems.includes(event.itemStack.typeId as MinecraftItemTypes)) {
      if (!canBypass(player)) {
        event.cancel = true;
        mc.system.run(() => {
          setActionBarOverride(player, '§cYou cannot use projectiles here.', 2500);
        });
      }
    }
  }
}

export function handlePlayerInteractWithBlock(event: mc.PlayerInteractWithBlockBeforeEvent) {
  const { player, block, itemStack } = event;
  if (!isDefined(player) || !isDefined(block)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }
  if (handleWandInteractBlock(event)) {
    return;
  }

  const flags = getProtectionFlags(block.location, player.dimension.id);
  const isFireStarter =
    itemStack?.typeId === MinecraftItemTypes.FlintAndSteel || itemStack?.typeId === MinecraftItemTypes.FireCharge;

  if (isFireStarter && (flags.preventPvP || flags.preventBlockPlacing || flags.preventBlockInteraction)) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot use fire starters here.', 2500);
      });
      return;
    }
  }

  if (flags.preventBlockInteraction) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot interact with blocks here.', 2500);
      });
    }
  }
}

export function handlePlayerInteractWithEntity(event: mc.PlayerInteractWithEntityBeforeEvent) {
  const { player, target } = event;
  if (!isDefined(player) || !isDefined(target)) {
    return;
  }
  if (player.hasTag(frozenTag)) {
    event.cancel = true;
    return;
  }

  const flags = getProtectionFlags(target.location, target.dimension.id);

  if (flags.preventEntityInteraction) {
    // We only want to prevent interaction with entities that are NOT meant to be ridden/pets
    // Let's allow interaction with players, tameables (wolves, cats, parrots),
    // rideables (horses, donkeys, mules, pigs with saddle, striders)

    if (target.typeId !== MinecraftEntityTypes.Player) {
      // Allow interactions if it can be tamed or ridden (pets/mounts)
      const canRide = target.hasComponent(EntityComponentTypes.Rideable);
      const canTame = target.hasComponent(EntityComponentTypes.Tameable);
      const tameComp = target.getComponent(EntityComponentTypes.IsTamed) as mc.EntityIsTamedComponent | undefined;
      const isTamed = isDefined(tameComp?.tamedToPlayerId) || target.hasComponent(EntityComponentTypes.IsTamed);

      if (!canRide && !canTame && !isTamed) {
        if (!canBypass(player)) {
          event.cancel = true;
          mc.system.run(() => {
            setActionBarOverride(player, '§cYou cannot interact with entities here.', 2500);
          });
        }
      }
    }
  }
}

export function handleBeforeItemPickup(event: mc.EntityItemPickupBeforeEvent) {
  const entity = event.entity;
  if (entity.typeId !== MinecraftEntityTypes.Player) {
    return;
  }
  const player = entity as mc.Player;

  const flags = getProtectionFlags(player.location, player.dimension.id);
  if (flags.preventItemPickup) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot pick up items here.', 2500);
      });
    }
  }
}

export function handleBeforeEntitySpawn(event: mc.EntitySpawnAfterEvent) {
  const { entity } = event;
  if (!isDefined(entity)) {
    return;
  }
  try {
    const isValid = entity.isValid;
    if (!isValid) {
      return;
    }

    // If hostile spawning is prevented
    if (entity.typeId !== MinecraftEntityTypes.Player) {
      const familyTypes = entity.getComponent(EntityComponentTypes.TypeFamily);
      if (familyTypes?.hasTypeFamily('monster')) {
        const flags = getProtectionFlags(entity.location, entity.dimension.id);
        if (flags.preventHostileMobSpawning) {
          // Cannot cancel afterEvent, so we despawn
          mc.system.run(() => {
            try {
              const isStillValid = entity.isValid;
              if (isStillValid) {
                entity.remove();
              }
            } catch {
              // ignore
            }
          });
        }
      }
    }
  } catch {
    // Ignore InvalidEntityError
  }
}

export function handleBeforePlayerItemAttackEntity(event: mc.PlayerItemAttackEntityBeforeEvent) {
  const player = event.player;
  const targetEntity = event.target;
  if (!isDefined(player) || !isDefined(targetEntity)) {
    return;
  }
  if (
    hasTeleportProtection(player.id) ||
    (targetEntity.typeId === MinecraftEntityTypes.Player && hasTeleportProtection(targetEntity.id))
  ) {
    event.cancel = true;
    mc.system.run(() => {
      setActionBarOverride(player, '§ePost-teleport protection active — combat locked briefly.', 1500);
    });
    return;
  }

  const flags = getProtectionFlags(targetEntity.location, targetEntity.dimension.id);
  if (flags.preventPvP && targetEntity.typeId === MinecraftEntityTypes.Player && targetEntity.id !== player.id) {
    if (!canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cPvP is disabled in this area.', 2500);
      });
    }
    return;
  }

  if (flags.preventEntityInteraction && targetEntity.typeId !== MinecraftEntityTypes.Player) {
    const familyTypes = targetEntity.getComponent(EntityComponentTypes.TypeFamily);
    if (!familyTypes?.hasTypeFamily('monster') && !canBypass(player)) {
      event.cancel = true;
      mc.system.run(() => {
        setActionBarOverride(player, '§cYou cannot attack non-hostile entities here.', 2500);
      });
    }
  }
}

export function handleBeforeEntityHurt(event: mc.EntityHurtBeforeEvent) {
  const { damageSource } = event;
  const victim = event.hurtEntity;

  if (victim.typeId === MinecraftEntityTypes.Player && hasTeleportProtection(victim.id)) {
    event.cancel = true;
    return;
  }
  let damager: mc.Entity | undefined = damageSource.damagingEntity;
  if (isDefined(damager) && damager.isValid) {
    try {
      const projComp = damager.getComponent(EntityComponentTypes.Projectile);
      damager = projComp?.owner ?? damager;
    } catch {
      // Ignore if entity is invalid
    }
  }
  if (
    isDefined(damager) &&
    damager.isValid &&
    damager.typeId === MinecraftEntityTypes.Player &&
    hasTeleportProtection(damager.id)
  ) {
    event.cancel = true;
    return;
  }

  const flags = getProtectionFlags(victim.location, victim.dimension.id);
  const cause = damageSource.cause;

  // Fall damage protection (All entities)
  if (flags.preventFallDamage && cause === mc.EntityDamageCause.fall) {
    event.cancel = true;
    return;
  }

  // Magic damage protection (All entities)
  if (flags.preventMagicDamage && (cause === mc.EntityDamageCause.magic || cause === mc.EntityDamageCause.wither)) {
    event.cancel = true;
    return;
  }

  // Explosion damage protection (All entities)
  if (
    flags.preventExplosions &&
    (cause === mc.EntityDamageCause.entityExplosion || cause === mc.EntityDamageCause.blockExplosion)
  ) {
    event.cancel = true;
    return;
  }

  if (victim.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  const player = victim as mc.Player;

  // Fire, lava, and burning environment protection in PvP safezones
  const isFireOrLavaDamage =
    cause === mc.EntityDamageCause.fire ||
    cause === mc.EntityDamageCause.fireTick ||
    cause === mc.EntityDamageCause.lava ||
    cause === mc.EntityDamageCause.campfire ||
    cause === mc.EntityDamageCause.soulCampfire;

  if (flags.preventPvP && isFireOrLavaDamage) {
    event.cancel = true;
    return;
  }

  if (!flags.preventPvP && !flags.preventHostileDamage) {
    return;
  }

  const damagingEntity = damageSource.damagingEntity;

  // Helper to get actual attacker (e.g., owner of projectile)
  let attacker: mc.Entity | undefined = damagingEntity;
  if (isDefined(damagingEntity) && damagingEntity.isValid) {
    try {
      const projectileComponent = damagingEntity.getComponent(EntityComponentTypes.Projectile);
      attacker = projectileComponent?.owner ?? damagingEntity;
    } catch {
      // Ignore
    }
  }

  // PvP Protection: evaluate flags for both victim and attacker to prevent safezone border exploits
  if (
    isDefined(attacker) &&
    attacker.isValid &&
    attacker.typeId === MinecraftEntityTypes.Player &&
    attacker.id !== player.id
  ) {
    let attackerPreventPvP = false;
    if (isDefined(attacker.location) && isDefined(attacker.dimension?.id)) {
      attackerPreventPvP = getProtectionFlags(attacker.location, attacker.dimension.id).preventPvP;
    }
    if (flags.preventPvP || attackerPreventPvP) {
      event.cancel = true;
      return;
    }
  }

  // Hostile Damage Protection
  if (
    flags.preventHostileDamage &&
    isDefined(attacker) &&
    attacker.isValid &&
    attacker.typeId !== MinecraftEntityTypes.Player
  ) {
    // Direct damage from non-player entities
    try {
      const familyTypes = attacker.getComponent(EntityComponentTypes.TypeFamily);
      if (familyTypes?.hasTypeFamily('monster') || familyTypes?.hasTypeFamily('mob')) {
        event.cancel = true;
        return;
      } else if (!familyTypes?.hasTypeFamily('inanimate') && !familyTypes?.hasTypeFamily('player')) {
        event.cancel = true;
        return;
      }
    } catch {
      // Ignore if entity became invalid
    }
  }
}
