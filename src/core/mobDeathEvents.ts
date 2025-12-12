import * as mc from '@minecraft/server';

import { getTeamByPlayer } from '@features/teams/teamManager.js';

import { getEconomyConfig } from './configurations.js';
import { infoLog } from './logger.js';
import {
    getPlayer,
    incrementDeathCount,
    incrementKillCount,
    incrementKillStreak,
    incrementPlayerBalance,
    resetKillStreak
} from './playerDataManager.js';
import { handlePvPDeath } from './pvpManager.js';
import { formatCurrency } from './utils.js';

mc.world.afterEvents.entityDie.subscribe((event: mc.EntityDieAfterEvent) => {
    const { deadEntity, damageSource } = event;
    const { damagingEntity } = damageSource;

    // Handle Player Death (Stat updates)
    if (deadEntity.typeId === 'minecraft:player') {
        const victim = deadEntity as mc.Player;
        incrementDeathCount(victim.id);
        resetKillStreak(victim.id);
    }

    if (!damagingEntity || damagingEntity.typeId !== 'minecraft:player') {
        return;
    }

    const killer = damagingEntity as mc.Player;
    incrementKillCount(killer.id);
    incrementKillStreak(killer.id);
    const economyConfig = getEconomyConfig();

    if (deadEntity.typeId === 'minecraft:player') {
        const victim = deadEntity as mc.Player;

        if (handlePvPDeath(victim, killer)) {
            return;
        }

        if (economyConfig.steal && economyConfig.steal.enabled) {
            const { percent, sameTeamImmunity } = economyConfig.steal;

            if (sameTeamImmunity) {
                const killerTeam = getTeamByPlayer(killer.id);
                const victimTeam = getTeamByPlayer(victim.id);
                if (killerTeam && victimTeam && killerTeam.id === victimTeam.id) {
                    return;
                }
            }

            const victimData = getPlayer(victim.id);
            if (victimData && victimData.balance > 0) {
                let stolenAmount = Math.floor(victimData.balance * (percent / 100));
                if (stolenAmount > 0) {
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

    if (!economyConfig || !economyConfig.mobMoney) {
        return;
    }

    const mobId = deadEntity.typeId;
    const reward = economyConfig.mobMoney[mobId];

    if (reward && reward !== 0) {
        incrementPlayerBalance(killer.id, reward);
        if (reward > 0) {
            infoLog(`Gave ${killer.name} ${formatCurrency(reward)} for killing a ${mobId}.`);
        } else {
            infoLog(`Took ${formatCurrency(Math.abs(reward))} from ${killer.name} for killing a ${mobId}.`);
            killer.sendMessage(`§cPenalty: ${formatCurrency(reward)} for killing a ${mobId}.`);
        }
    }
});
