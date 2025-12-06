/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import * as mc from '@minecraft/server';

import * as lastHitManager from '../lastHitManager.js';

export const eventName = 'entityHurt';

function handleEntityHurt(event: mc.EntityHurtAfterEvent) {
    const { hurtEntity, damageSource } = event;
    const victim = hurtEntity;

    if (victim?.typeId !== 'minecraft:player') {
        return;
    }

    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) {
        return;
    }

    // Check for owner (e.g. projectile or tameable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attacker = (damagingEntity as any).owner ?? damagingEntity;

    if (attacker?.typeId === 'minecraft:player' && attacker.id !== victim.id) {
        lastHitManager.setLastHit(victim.id, (attacker as mc.Player).id);

        // Friendly Fire Check
        // Note: This event is AFTER damage. We cannot cancel it here efficiently for vanilla damage.
        // However, the scripting API allows cancelling entityHurt in `beforeEvents`?
        // This file is imported as 'entityHurt' which usually implies 'afterEvents' or the filename is just a label.
        // Wait, looking at eventManager.js is safer to know if it's before or after.
        // Assuming standard "entityHurt" is usually AFTER. If we want to cancel, we need `entityHurt` from `world.beforeEvents`?
        // Or use `damage` component logic? The prompt asked for "without affecting performance".
        // Cancelling in afterEvent heals the player? No.

        // If this is bound to afterEvents, we can't stop damage.
        // I need to check eventManager.js.
    }
}

export default handleEntityHurt;
