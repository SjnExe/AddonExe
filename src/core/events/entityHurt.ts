/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

import * as lastHitManager from '@core/lastHitManager.js';

export const eventName = 'entityHurt';

function handleEntityHurt(event: mc.EntityHurtAfterEvent) {
    const { hurtEntity, damageSource } = event;
    const victim = hurtEntity;

    if (victim?.typeId !== MinecraftEntityTypes.Player) {
        return;
    }

    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) {
        return;
    }

    // Check for owner (e.g. projectile or tameable)
    // Define an interface for entities that might have an owner property (like projectiles)
    interface EntityWithOwner extends mc.Entity {
        owner?: mc.Entity;
    }

    const attacker = (damagingEntity as EntityWithOwner).owner ?? damagingEntity;

    if (attacker?.typeId === MinecraftEntityTypes.Player && attacker.id !== victim.id) {
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
