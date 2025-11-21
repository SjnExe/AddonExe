import { getPlayerTeamId } from '../teamManager.js';
import { teamConfig } from '../teamConfig.js';

export const eventName = 'beforeEntityHurt';

function handleBeforeEntityHurt(event) {
    const { hurtEntity, damageSource } = event;

    // Optimization: Only care if victim is player
    if (hurtEntity.typeId !== 'minecraft:player') {return;}

    const attacker = damageSource.damagingEntity;
    if (!attacker || attacker.typeId !== 'minecraft:player') {return;}

    // Self-damage is allowed
    if (attacker.id === hurtEntity.id) {return;}

    // Friendly Fire Check
    if (!teamConfig.friendlyFire) {
        const victimTeamId = getPlayerTeamId(hurtEntity.id);
        if (victimTeamId) {
            const attackerTeamId = getPlayerTeamId(attacker.id);
            if (victimTeamId === attackerTeamId) {
                event.cancel = true;
            }
        }
    }
}

export default handleBeforeEntityHurt;
