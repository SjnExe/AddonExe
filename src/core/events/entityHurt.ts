import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

import { setLastHit } from '@features/essentials/combatManager.js';

export const eventName = 'entityHurt';

function handleEntityHurt(event: mc.EntityHurtAfterEvent): void {
    const { hurtEntity: victim, damageSource } = event;
    if (victim.typeId !== MinecraftEntityTypes.Player) {
        return;
    }

    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) {
        return;
    }

    interface EntityWithOwner extends mc.Entity {
        owner?: mc.Entity;
    }

    const attacker = (damagingEntity as EntityWithOwner).owner ?? damagingEntity;

    if (attacker.typeId === MinecraftEntityTypes.Player && attacker.id !== victim.id) {
        setLastHit(victim.id, attacker.id);
        setLastHit(attacker.id, victim.id);
    }
}

export default handleEntityHurt;
