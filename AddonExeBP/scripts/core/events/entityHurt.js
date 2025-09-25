import * as lastHitManager from '../lastHitManager.js';

export const eventName = 'entityHurt';

function handleEntityHurt(event) {
    const { hurtEntity, damageSource } = event;
    const victim = hurtEntity;

    if (victim?.typeId !== 'minecraft:player') {
        return;
    }

    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) {
        return;
    }

    const attacker = damagingEntity.owner ?? damagingEntity;

    if (attacker?.typeId === 'minecraft:player' && attacker.id !== victim.id) {
        lastHitManager.setLastHit(victim.id, attacker.id);
    }
}

export default handleEntityHurt;