import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getEconomyConfig } from '@core/configurations.js';
import { isFeatureActive } from '@core/featureManager.js';
import * as lastHitManager from '@core/lastHitManager.js';
import { debugLog, errorLog, infoLog } from '@core/logger.js';
import * as playerCache from '@core/playerCache.js';
import {
    getOrCreatePlayer,
    getPlayer,
    incrementDeathCount,
    incrementKillCount,
    incrementKillStreak,
    incrementPlayerBalance,
    resetKillStreak,
    setPlayerLastDeathLocation
} from '@core/playerDataManager.js';
import { formatCurrency } from '@core/utils.js';
import * as bountyManager from '@features/economy/bountyManager.js';
import { handlePvPDeath } from '@features/essentials/pvpManager.js';
import * as teamManager from '@features/team/manager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined, isNumber } from '@lib/guards.js';

export const eventName = 'entityDie';

function resolveKiller(deadEntity: mc.Entity, damagingEntity: mc.Entity | undefined, creditTimeoutSeconds: number): mc.Player | undefined {
    if (isDefined(damagingEntity)) {
        const owner = (damagingEntity as mc.Entity & { owner?: mc.Entity }).owner ?? damagingEntity;
        if (owner.typeId === MinecraftEntityTypes.Player) {
            return owner as mc.Player;
        }
    }

    const lastHit = lastHitManager.getLastHit(deadEntity.id);
    if (!isDefined(lastHit)) {
        return undefined;
    }

    lastHitManager.clearLastHit(deadEntity.id);
    const timeSinceHit = (Date.now() - lastHit.timestamp) / 1000;
    if (timeSinceHit > creditTimeoutSeconds) {
        debugLog(`[EntityDie] Kill credit for ${deadEntity.id} expired. Time since last hit: ${timeSinceHit}s`);
        return undefined;
    }

    return playerCache.getPlayerFromCache(lastHit.attackerId);
}

function processBountyAndSteal(deadPlayer: mc.Player, killer: mc.Player) {
    if (!isFeatureActive('eco')) {
        return;
    }

    const config = getConfig();
    if (config.bounties.enabled) {
        const bounty = bountyManager.getBounty(deadPlayer.id);
        if (isDefined(bounty) && bounty.amount > 0) {
            const killerTeamId = teamManager.getPlayerTeamId(killer.id);
            const victimTeamId = teamManager.getPlayerTeamId(deadPlayer.id);

            if (isDefined(killerTeamId) && isDefined(victimTeamId) && killerTeamId === victimTeamId) {
                killer.sendMessage('§cYou cannot claim bounties on teammates!');
            } else {
                incrementPlayerBalance(killer.id, bounty.amount);
                bountyManager.removeBounty(deadPlayer.id);
                mc.world.sendMessage(`§a${killer.name} has claimed the bounty of §e${formatCurrency(bounty.amount)}§a on ${deadPlayer.name}!`);
                debugLog(`[BountyClaim] ${killer.name} claimed bounty on ${deadPlayer.name} for $${bounty.amount}.`);
            }
        }
    }

    if (handlePvPDeath(deadPlayer, killer) === true) {
        return;
    }

    const economyConfig = getEconomyConfig();
    if (economyConfig.steal.enabled) {
        const { percent, sameTeamImmunity } = economyConfig.steal;
        if (sameTeamImmunity) {
            const killerTeam = teamManager.getTeamByPlayer(killer.id);
            const victimTeam = teamManager.getTeamByPlayer(deadPlayer.id);
            if (isDefined(killerTeam) && isDefined(victimTeam) && killerTeam.id === victimTeam.id) {
                return;
            }
        }

        const victimData = getPlayer(deadPlayer.id);
        if (isDefined(victimData) && victimData.balance > 0) {
            let stolenAmount = Math.floor(victimData.balance * (percent / 100));
            if (stolenAmount > 0) {
                stolenAmount = Math.min(stolenAmount, victimData.balance);
                incrementPlayerBalance(deadPlayer.id, -stolenAmount);
                incrementPlayerBalance(killer.id, stolenAmount);
                killer.sendMessage(`§aYou stole ${formatCurrency(stolenAmount)} from ${deadPlayer.name}!`);
                deadPlayer.sendMessage(`§c${killer.name} stole ${formatCurrency(stolenAmount)} from you!`);
            }
        }
    }
}

export function handleEntityDie(event: mc.EntityDieAfterEvent) {
    try {
        const { deadEntity, damageSource } = event;
        const config = getConfig();
        const killer = resolveKiller(deadEntity, damageSource.damagingEntity, config.bounties.bountyCreditTimeoutSeconds);

        if (deadEntity.typeId === MinecraftEntityTypes.Player) {
            const deadPlayer = deadEntity as mc.Player;
            saveLastLocation(deadPlayer, 'death');

            if (config.playerInfo.enableDeathCoords) {
                getOrCreatePlayer(deadPlayer);
                setPlayerLastDeathLocation(deadPlayer.id, {
                    x: deadPlayer.location.x,
                    y: deadPlayer.location.y,
                    z: deadPlayer.location.z,
                    dimensionId: deadPlayer.dimension.id
                });
            }

            resetKillStreak(deadPlayer.id);

            if (isDefined(killer) && killer.isValid && killer.id !== deadPlayer.id) {
                incrementDeathCount(deadPlayer.id);
                incrementKillCount(killer.id);
                incrementKillStreak(killer.id);
                processBountyAndSteal(deadPlayer, killer);
            }
            return;
        }

        if (!isDefined(killer) || !killer.isValid || !isFeatureActive('eco')) {
            return;
        }

        const economyConfig = getEconomyConfig();
        const reward = economyConfig.mobMoney[deadEntity.typeId];
        if (isNumber(reward) && reward !== 0) {
            incrementPlayerBalance(killer.id, reward);
            if (reward > 0) {
                infoLog(`Gave ${killer.name} ${formatCurrency(reward)} for killing a ${deadEntity.typeId}.`);
            } else {
                infoLog(`Took ${formatCurrency(Math.abs(reward))} from ${killer.name} for killing a ${deadEntity.typeId}.`);
                killer.sendMessage(`§cPenalty: ${formatCurrency(reward)} for killing a ${deadEntity.typeId}.`);
            }
        }
    } catch (error: unknown) {
        errorLog('[EntityDie] A fatal error occurred during entityDie processing.', error);
    }
}

export default handleEntityDie;
