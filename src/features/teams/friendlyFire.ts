import * as mc from '@minecraft/server';
import { getTeamByPlayer } from './teamManager.js';

export function initializeFriendlyFire() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mc.world.afterEvents.entityDamage.subscribe((event: mc.EntityDamageAfterEvent) => {
        const target = event.entity;
        const source = event.damageSource.damagingEntity;

        if (!(target instanceof mc.Player) || !(source instanceof mc.Player)) {
            return;
        }

        const targetTeam = getTeamByPlayer(target.id);
        const sourceTeam = getTeamByPlayer(source.id);

        if (targetTeam && sourceTeam && targetTeam.id === sourceTeam.id) {
            // Friendly Fire detected
            // Warn attacker
            source.sendMessage('§c[Friendly Fire] You are attacking a teammate!');
        }
    });
}
