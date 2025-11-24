import * as mc from '@minecraft/server';
import { getEconomyConfig } from './configurations.js';
import { incrementPlayerBalance, getPlayer } from './playerDataManager.js';
import { infoLog } from './logger.js';
import { formatCurrency } from './utils.js';
import { handlePvPDeath } from './pvpManager.js';
import { getTeamByPlayer } from './teamManager.js';

mc.world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const { damagingEntity } = damageSource;

    if (!damagingEntity || damagingEntity.typeId !== 'minecraft:player') {
        return;
    }

    const killer = damagingEntity;
    const economyConfig = getEconomyConfig();

    // Handle Player Death (PvP & Steal)
    if (deadEntity.typeId === 'minecraft:player') {
        const victim = deadEntity;

        // Check for active Duel first
        // handlePvPDeath returns true if the death was part of a registered duel
        if (handlePvPDeath(victim, killer)) {
            return;
        }

        // Handle Steal System
        if (economyConfig.steal && economyConfig.steal.enabled) {
            const { percent, sameTeamImmunity } = economyConfig.steal;

            // Check Team Immunity
            if (sameTeamImmunity) {
                const killerTeam = getTeamByPlayer(killer.id);
                const victimTeam = getTeamByPlayer(victim.id);
                if (killerTeam && victimTeam && killerTeam.id === victimTeam.id) {
                    return; // Same team, no steal
                }
            }

            const victimData = getPlayer(victim.id);
            if (victimData && victimData.balance > 0) {
                let stolenAmount = Math.floor(victimData.balance * (percent / 100));
                if (stolenAmount > 0) {
                    // Cap at actual balance to prevent negative balance if race condition (though incrementPlayerBalance handles min/max)
                    stolenAmount = Math.min(stolenAmount, victimData.balance);

                    incrementPlayerBalance(victim.id, -stolenAmount);
                    incrementPlayerBalance(killer.id, stolenAmount);

                    killer.sendMessage(`§aYou stole ${formatCurrency(stolenAmount)} from ${victim.name}!`);
                    victim.sendMessage(`§c${killer.name} stole ${formatCurrency(stolenAmount)} from you!`);
                }
            }
        }
        return;
    }

    // Handle Mob Drops
    if (!economyConfig || !economyConfig.mobMoney) {
        return;
    }

    const mobId = deadEntity.typeId;
    const reward = economyConfig.mobMoney[mobId];

    if (reward && reward > 0) {
        incrementPlayerBalance(damagingEntity.id, reward);
        infoLog(
            `Gave ${damagingEntity.name} ${formatCurrency(reward)} for killing a ${mobId}.`
        );
    }
});
