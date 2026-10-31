import { recordMovementDamage } from '@features/anticheat/movementCheck.js';
import { setLastHit } from '@features/essentials/combat/manager.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export const eventName = 'entityHurt';

function handleEntityHurt(event: mc.EntityHurtAfterEvent): void {
  const { hurtEntity: victim, damageSource } = event;
  if (victim.typeId !== MinecraftEntityTypes.Player) {
    return;
  }

  recordMovementDamage(victim.id);

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

export default handleEntityHurt;
