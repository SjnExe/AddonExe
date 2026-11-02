import { getConfig } from '@core/config/configManager.js';
import { updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { recordMovementDamage } from '@features/anticheat/movementCheck.js';
import { setLastHit } from '@features/essentials/combat/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export const eventName = 'entityHurt';

const pendingHealthRefreshes = new Set<string>();

/**
 * Schedules a coalesced nametag health refresh for a player after one tick delay.
 *
 * @param player The player entity whose nametag health indicator should be refreshed.
 */
function scheduleHealthRefresh(player: mc.Player): void {
  if (pendingHealthRefreshes.has(player.id)) {
    return;
  }
  pendingHealthRefreshes.add(player.id);
  mc.system.runTimeout(() => {
    pendingHealthRefreshes.delete(player.id);
    try {
      if (player.isValid) {
        updatePlayerNameTag(player);
      }
    } catch {
      // Ignore
    }
  }, 1);
}

/**
 * Handles entity hurt after-events to record combat damage, update last hit timers, and refresh player nametags.
 *
 * @param event The entity hurt after-event payload.
 */
function handleEntityHurt(event: mc.EntityHurtAfterEvent): void {
  const { hurtEntity: victim, damageSource } = event;
  if (victim.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  recordMovementDamage(victim.id);

  const config = getConfig();
  if (config.playerInfo?.healthIndicator?.enabled === true) {
    scheduleHealthRefresh(victim as mc.Player);
  }

  const damagingEntity = damageSource.damagingEntity;
  if (!damagingEntity || !damagingEntity.isValid) {
    return;
  }

  try {
    const projectileComp = damagingEntity.getComponent(mc.EntityComponentTypes.Projectile) as
      mc.EntityProjectileComponent | undefined;
    const tameComp = damagingEntity.getComponent(mc.EntityComponentTypes.Tameable) as
      mc.EntityTameableComponent | undefined;
    const attacker = projectileComp?.owner ?? tameComp?.tamedToPlayer ?? damagingEntity;

    if (attacker?.isValid && attacker.typeId === MinecraftEntityTypes.Player && attacker.id !== victim.id) {
      setLastHit(victim.id, attacker.id);
      setLastHit(attacker.id, victim.id);
    }
  } catch {
    // Entity may have been removed / invalid in the same tick (e.g. exploding creeper)
  }
}

/**
 * Handles entity health change after-events to refresh player nametag health indicators upon healing or regeneration.
 *
 * @param event The entity health changed after-event payload.
 */
export function handleEntityHealthChanged(event: mc.EntityHealthChangedAfterEvent): void {
  const victim = event.entity;
  if (!victim.isValid || victim.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  const config = getConfig();
  if (config.playerInfo?.healthIndicator?.enabled === true) {
    scheduleHealthRefresh(victim as mc.Player);
  }
}

export default handleEntityHurt;
