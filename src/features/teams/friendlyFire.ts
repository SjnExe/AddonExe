import * as mc from '@minecraft/server';

import { teamConfig } from './teamConfig.js';
import { getTeamByPlayer } from './teamManager.js';

function onEntityHurt(event: mc.EntityHurtAfterEvent) {
    if (!event.damageSource.damagingEntity || event.damageSource.damagingEntity.typeId !== 'minecraft:player') {
        return;
    }
    if (event.hurtEntity.typeId !== 'minecraft:player') {
        return;
    }

    const attacker = event.damageSource.damagingEntity as mc.Player;
    const victim = event.hurtEntity as mc.Player;

    if (attacker.id === victim.id) {
        return;
    } // Self damage

    const attackerTeam = getTeamByPlayer(attacker.id);
    const victimTeam = getTeamByPlayer(victim.id);

    if (attackerTeam && victimTeam && attackerTeam.id === victimTeam.id) {
        // Check per-team friendly fire setting
        // If friendly fire is disabled (false), we should warn
        if (attackerTeam.friendlyFire === false) {
            attacker.onScreenDisplay.setActionBar('§cDo not hurt your teammates!');
            attacker.playSound('note.bass');
        }
    }
}

export function registerFriendlyFire() {
    mc.world.afterEvents.entityHurt.subscribe(onEntityHurt);
}
