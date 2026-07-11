/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as mc from '@minecraft/server';

import { getTeamByPlayer } from '@features/team/manager.js';
import { isNumber } from '@lib/guards.js';

import { getConfig } from '@core/configManager.js';
import { getEconomyConfig } from '@core/configurations.js';
import * as lastHitManager from '@core/lastHitManager.js';
import { infoLog } from '@core/logger.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayer, incrementDeathCount, incrementKillCount, incrementKillStreak, incrementPlayerBalance, resetKillStreak } from '@core/playerDataManager.js';
import { formatCurrency } from '@core/utils.js';
import { handlePvPDeath } from '@features/essentials/pvpManager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

mc.world.afterEvents.entityDie.subscribe((event: mc.EntityDieAfterEvent) => {
    const { deadEntity, damageSource } = event;
    const { damagingEntity } = damageSource;

    let killer: mc.Player | undefined;

    if (damagingEntity && damagingEntity.typeId === MinecraftEntityTypes.Player) {
        killer = damagingEntity as mc.Player;
    } else {
        // Indirect kill (Void, etc.)
        const lastHit = lastHitManager.getLastHit(deadEntity.id);
        if (lastHit) {
            const config = getConfig(); // Need main config for timeout
            // Default 15s if not found
            const creditTimeout = config.bounties.bountyCreditTimeoutSeconds ?? 15;
            if ((Date.now() - lastHit.timestamp) / 1000 <= creditTimeout) {
                killer = getPlayerFromCache(lastHit.attackerId);
            }
        }
    }

    // Handle Player Death (Stat updates)
    if (deadEntity.typeId === MinecraftEntityTypes.Player) {
        const victim = deadEntity as mc.Player;
        // KDR Death: Only count if killed by another player (PvP)
        if (killer && killer.isValid && killer.typeId === MinecraftEntityTypes.Player) {
            incrementDeathCount(victim.id);
        }
        resetKillStreak(victim.id);
        // Save death location for /back
        saveLastLocation(victim, 'death');
    }

    if (!killer || !killer.isValid) {
        return;
    }

    // KDR Kill & Streak: Only count if victim was a player (PvP)
    if (deadEntity.typeId === MinecraftEntityTypes.Player) {
        incrementKillCount(killer.id);
        incrementKillStreak(killer.id);
    }

    const economyConfig = getEconomyConfig();

    if (deadEntity.typeId === MinecraftEntityTypes.Player) {
        const victim = deadEntity as mc.Player;

        if (handlePvPDeath(victim, killer) === true) {
            return;
        }

        if (economyConfig.steal?.enabled) {
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

    const mobId = deadEntity.typeId;
    const reward = economyConfig.mobMoney[mobId];

    if (isNumber(reward) && reward !== 0) {
        incrementPlayerBalance(killer.id, reward);
        if (reward > 0) {
            infoLog(`Gave ${killer.name} ${formatCurrency(reward)} for killing a ${mobId}.`);
        } else {
            infoLog(`Took ${formatCurrency(Math.abs(reward))} from ${killer.name} for killing a ${mobId}.`);
            killer.sendMessage(`§cPenalty: ${formatCurrency(reward)} for killing a ${mobId}.`);
        }
    }
});
