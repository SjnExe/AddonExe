import { getConfig } from '@core/config/configManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getPlayer, incrementDeathCount, incrementKillCount, incrementKillStreak, incrementPlayerBalance, loadPlayerData, resetKillStreak } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency } from '@core/utils/economy.js';
import { debugLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { clearTrackedTimeout, setTrackedTimeout } from '@core/utils/timerManager.js';
import * as bountyManager from '@features/economy/bountyManager.js';
import * as teamManager from '@features/social/team/manager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export interface LastHitInfo {
    attackerId: string;
    timestamp: number;
}

interface PvpRequest {
    requesterId: string;
    amount: number;
    timestamp: number;
    timeoutId: number;
}

interface ActiveDuel {
    opponentId: string;
    amount: number;
    startTime: number;
    timeoutId: number;
}

interface PendingDisconnectPenalty {
    victimId: string;
    victimName: string;
    attackerId: string;
    remainingCombatMs: number;
    timerId: number;
}

const lastHitData = new Map<string, LastHitInfo>();
const pvpRequests = new Map<string, PvpRequest>();
const activeDuels = new Map<string, ActiveDuel>();
const pendingDisconnects = new Map<string, PendingDisconnectPenalty>();
const pendingKillOnRejoin = new Set<string>();

export function getCombatTimeoutSeconds(): number {
    try {
        const cfg = getConfig();
        return cfg.combat?.tagDurationSeconds ?? cfg.bounties?.bountyCreditTimeoutSeconds ?? 15;
    } catch {
        return 15;
    }
}

export function setLastHit(victimId: string, attackerId: string): void {
    const now = Date.now();
    lastHitData.set(victimId, {
        attackerId,
        timestamp: now
    });
}

export function getLastHit(victimId: string): LastHitInfo | undefined {
    return lastHitData.get(victimId);
}

export function clearLastHit(victimId: string): void {
    lastHitData.delete(victimId);
}

export function getRemainingCombatCooldown(playerId: string): number {
    if (activeDuels.has(playerId)) {
        return getCombatTimeoutSeconds();
    }
    const hit = lastHitData.get(playerId);
    if (!isDefined(hit)) {
        return 0;
    }
    const timeoutSec = getCombatTimeoutSeconds();
    const elapsedSec = (Date.now() - hit.timestamp) / 1000;
    if (elapsedSec >= timeoutSec) {
        lastHitData.delete(playerId);
        return 0;
    }
    return Math.ceil(timeoutSec - elapsedSec);
}

export function isInCombat(playerId: string): boolean {
    try {
        if (getConfig().combat?.enabled === false) {
            return activeDuels.has(playerId);
        }
    } catch {
        // Fallback if config uninitialized
    }
    return getRemainingCombatCooldown(playerId) > 0;
}

export function resolveKiller(deadEntity: mc.Entity, damagingEntity: mc.Entity | undefined, creditTimeoutSeconds = getCombatTimeoutSeconds()): mc.Player | undefined {
    if (isDefined(damagingEntity)) {
        const owner = (damagingEntity as mc.Entity & { owner?: mc.Entity }).owner ?? damagingEntity;
        if (owner.typeId === MinecraftEntityTypes.Player) {
            clearLastHit(deadEntity.id);
            return owner as mc.Player;
        }
    }

    const lastHit = getLastHit(deadEntity.id);
    if (!isDefined(lastHit)) {
        return undefined;
    }

    clearLastHit(deadEntity.id);
    const timeSinceHit = (Date.now() - lastHit.timestamp) / 1000;
    if (timeSinceHit > creditTimeoutSeconds) {
        debugLog(`[CombatManager] Kill credit for ${deadEntity.id} expired. Time since last hit: ${timeSinceHit}s`);
        return undefined;
    }

    return getPlayerFromCache(lastHit.attackerId);
}

export function processBountyAndSteal(victimId: string, victimName: string, killer: mc.Player, victimPlayer?: mc.Player): void {
    if (!isFeatureActive('eco')) {
        return;
    }

    const config = getConfig();
    if (config.bounties.enabled) {
        const bounty = bountyManager.getBounty(victimId);
        if (isDefined(bounty) && bounty.amount > 0) {
            const killerTeamId = teamManager.getPlayerTeamId(killer.id);
            const victimTeamId = teamManager.getPlayerTeamId(victimId);

            if (isDefined(killerTeamId) && isDefined(victimTeamId) && killerTeamId === victimTeamId) {
                killer.sendMessage('§cYou cannot claim bounties on teammates!');
            } else {
                incrementPlayerBalance(killer.id, bounty.amount);
                bountyManager.removeBounty(victimId);
                mc.world.sendMessage(`§a${killer.name} has claimed the bounty of §e${formatCurrency(bounty.amount)}§a on ${victimName}!`);
                debugLog(`[BountyClaim] ${killer.name} claimed bounty on ${victimName} for $${bounty.amount}.`);
            }
        }
    }

    if (isDefined(victimPlayer) && handlePvPDeath(victimPlayer, killer) === true) {
        return;
    }

    const economyConfig = getEconomyConfig();
    if (economyConfig.steal.enabled) {
        const { percent, sameTeamImmunity } = economyConfig.steal;
        if (sameTeamImmunity) {
            const killerTeam = teamManager.getTeamByPlayer(killer.id);
            const victimTeam = teamManager.getTeamByPlayer(victimId);
            if (isDefined(killerTeam) && isDefined(victimTeam) && killerTeam.id === victimTeam.id) {
                return;
            }
        }

        const victimData = getPlayer(victimId) ?? loadPlayerData(victimId);
        if (isDefined(victimData) && victimData.balance > 0) {
            let stolenAmount = Math.floor(victimData.balance * (percent / 100));
            if (stolenAmount > 0) {
                stolenAmount = Math.min(stolenAmount, victimData.balance);
                incrementPlayerBalance(victimId, -stolenAmount);
                incrementPlayerBalance(killer.id, stolenAmount);
                killer.sendMessage(`§aYou stole ${formatCurrency(stolenAmount)} from ${victimName}!`);
                if (isDefined(victimPlayer) && victimPlayer.isValid) {
                    victimPlayer.sendMessage(`§c${killer.name} stole ${formatCurrency(stolenAmount)} from you!`);
                }
            }
        }
    }
}

function executeCombatLogPenalty(victimId: string, victimName: string, attackerId: string): void {
    pendingDisconnects.delete(victimId);
    incrementDeathCount(victimId);
    resetKillStreak(victimId);
    incrementKillCount(attackerId);
    incrementKillStreak(attackerId);

    const killer = getPlayerFromCache(attackerId);
    if (isDefined(killer) && killer.isValid) {
        processBountyAndSteal(victimId, victimName, killer);
    }

    const cfg = getConfig();
    if (cfg.combat?.killOnRejoin === true) {
        pendingKillOnRejoin.add(victimId);
    }

    mc.world.sendMessage(`§c[Combat] §e${victimName} §cfailed to reconnect and was penalized for combat logging!`);
}

export function handleCombatPlayerLeave(playerId: string, playerName: string): void {
    // 1. If in an active duel, forfeit immediately
    const duel = activeDuels.get(playerId);
    if (isDefined(duel)) {
        const opponentId = duel.opponentId;
        const amount = duel.amount;
        mc.system.clearRun(duel.timeoutId);
        activeDuels.delete(playerId);
        activeDuels.delete(opponentId);
        clearLastHit(playerId);

        const opponent = getPlayerFromCache(opponentId);
        if (amount > 0) {
            incrementPlayerBalance(opponentId, amount * 2);
        }
        if (isDefined(opponent) && opponent.isValid) {
            sendMessage(
                amount > 0 ? `§6VICTORY! §e${playerName} §cdisconnected during the duel! You won §a${formatCurrency(amount * 2)}§c!` : `§6VICTORY! §e${playerName} §cdisconnected during the duel!`,
                opponent
            );
        }
        return;
    }

    // 2. Check standard combat tag
    const cfg = getConfig();
    if (cfg.combat?.enabled === false || cfg.combat?.combatLogPenalty === false) {
        clearLastHit(playerId);
        return;
    }

    const hit = getLastHit(playerId);
    if (!isDefined(hit)) {
        return;
    }

    const timeoutMs = getCombatTimeoutSeconds() * 1000;
    const elapsedMs = Date.now() - hit.timestamp;
    clearLastHit(playerId);

    if (elapsedMs >= timeoutMs) {
        return;
    }

    const graceSec = Math.max(0, Number(cfg.combat?.reconnectGraceSeconds ?? 30));
    if (graceSec <= 0) {
        executeCombatLogPenalty(playerId, playerName, hit.attackerId);
        return;
    }

    mc.world.sendMessage(`§c[Combat] §e${playerName} §clogged out in combat! They have §e${graceSec}s §cto reconnect.`);
    const timerId = setTrackedTimeout(() => {
        executeCombatLogPenalty(playerId, playerName, hit.attackerId);
    }, graceSec * 20);

    pendingDisconnects.set(playerId, {
        victimId: playerId,
        victimName: playerName,
        attackerId: hit.attackerId,
        remainingCombatMs: timeoutMs - elapsedMs,
        timerId
    });
}

export function handleCombatPlayerJoin(player: mc.Player): void {
    const pending = pendingDisconnects.get(player.id);
    if (isDefined(pending)) {
        clearTrackedTimeout(pending.timerId);
        pendingDisconnects.delete(player.id);
        const timeoutMs = getCombatTimeoutSeconds() * 1000;
        lastHitData.set(player.id, {
            attackerId: pending.attackerId,
            timestamp: Date.now() - Math.max(0, timeoutMs - pending.remainingCombatMs)
        });
        mc.world.sendMessage(`§e[Combat] §a${player.name} reconnected within the grace period! Combat tag resumed.`);
        return;
    }

    if (pendingKillOnRejoin.has(player.id)) {
        pendingKillOnRejoin.delete(player.id);
        mc.system.runTimeout(() => {
            if (player.isValid) {
                try {
                    player.kill();
                    player.sendMessage('§cYou were eliminated for logging out during combat.');
                } catch {
                    // Ignore if kill fails
                }
            }
        }, 5);
    }
}

// --- 1v1 PvP Wager Duels (/pvp) ---

export function requestPvP(requester: mc.Player, target: mc.Player, amount: number): void {
    const config = getEconomyConfig().pvp;
    if (!config.enabled) {
        sendMessage('§cPvP system is disabled.', requester);
        return;
    }

    if (activeDuels.has(requester.id)) {
        sendMessage('§cYou are already in a duel.', requester);
        return;
    }
    if (activeDuels.has(target.id)) {
        sendMessage('§cTarget player is already in a duel.', requester);
        return;
    }
    if (pvpRequests.has(target.id)) {
        sendMessage('§cTarget player already has a pending PvP request.', requester);
        return;
    }

    const pData = getPlayer(requester.id);
    if (pData && amount > 0 && pData.balance < amount) {
        sendMessage(`§cYou do not have enough money. Required: ${formatCurrency(amount)}`, requester);
        return;
    }

    if (amount > 0) {
        incrementPlayerBalance(requester.id, -amount);
    }

    const timeoutId = mc.system.runTimeout(() => {
        expireRequest(target.id);
    }, config.requestTimeout * 20);

    pvpRequests.set(target.id, {
        requesterId: requester.id,
        amount,
        timestamp: Date.now(),
        timeoutId
    });

    sendMessage(`§aPvP request sent to ${target.name} for ${formatCurrency(amount)}.`, requester);
    sendMessage(`§e${requester.name}§r has challenged you to a PvP duel for §6${formatCurrency(amount)}§r.`, target);
    sendMessage(`§eType §a/pvp accept§e to accept or §c/pvp deny§e to deny. Request expires in ${config.requestTimeout} seconds.`, target);
}

export function acceptPvP(player: mc.Player): void {
    const request = pvpRequests.get(player.id);
    if (!request) {
        sendMessage('§cYou have no pending PvP requests.', player);
        return;
    }

    const config = getEconomyConfig().pvp;
    const { requesterId, amount } = request;

    const requester = getPlayerFromCache(requesterId);
    if (!requester) {
        sendMessage('§cThe challenger is no longer online. Their wager has been refunded.', player);
        if (amount > 0) {
            incrementPlayerBalance(requesterId, amount);
        }
        clearRequest(player.id, false);
        return;
    }

    const pData = getPlayer(player.id);
    if (pData && amount > 0 && pData.balance < amount) {
        sendMessage(`§cYou do not have enough money to accept. Required: ${formatCurrency(amount)}`, player);
        return;
    }

    if (amount > 0) {
        incrementPlayerBalance(player.id, -amount);
    }

    mc.system.clearRun(request.timeoutId);
    pvpRequests.delete(player.id);

    const duelTimeoutId = mc.system.runTimeout(() => {
        timeoutDuel(player.id, requester.id);
    }, config.duelTimeout * 20);

    const duelData: Omit<ActiveDuel, 'opponentId'> = {
        amount,
        startTime: Date.now(),
        timeoutId: duelTimeoutId
    };

    activeDuels.set(player.id, { opponentId: requester.id, ...duelData });
    activeDuels.set(requester.id, { opponentId: player.id, ...duelData });

    sendMessage('§aDuel accepted! Fight!', player);
    sendMessage(`§a${player.name} accepted the duel! Fight!`, requester);
}

export function denyPvP(player: mc.Player): void {
    const request = pvpRequests.get(player.id);
    if (!request) {
        sendMessage('§cYou have no pending PvP requests.', player);
        return;
    }

    clearRequest(player.id, true);
    sendMessage('§aDuel request denied.', player);
}

function clearRequest(targetId: string, notifyRequester: boolean): void {
    const request = pvpRequests.get(targetId);
    if (!request) {
        return;
    }

    const { requesterId, amount } = request;

    if (amount > 0) {
        incrementPlayerBalance(requesterId, amount);
        if (notifyRequester) {
            const requester = getPlayerFromCache(requesterId);
            const target = getPlayerFromCache(targetId);
            if (requester && target) {
                sendMessage(`§c${target.name} denied your duel request. Money refunded.`, requester);
            }
        }
    }

    mc.system.clearRun(request.timeoutId);
    pvpRequests.delete(targetId);
}

function expireRequest(targetId: string): void {
    const request = pvpRequests.get(targetId);
    if (!request) {
        return;
    }

    const { requesterId, amount } = request;

    if (amount > 0) {
        incrementPlayerBalance(requesterId, amount);
        const requester = getPlayerFromCache(requesterId);
        if (requester) {
            sendMessage('§cPvP request expired and was refunded.', requester);
        }
    }

    const target = getPlayerFromCache(targetId);
    if (target) {
        sendMessage('§cPvP request expired.', target);
    }

    pvpRequests.delete(targetId);
}

function timeoutDuel(player1Id: string, player2Id: string): void {
    const duel = activeDuels.get(player1Id);
    if (!duel) {
        return;
    }

    const { amount } = duel;

    if (amount > 0) {
        incrementPlayerBalance(player1Id, amount);
        incrementPlayerBalance(player2Id, amount);
    }

    activeDuels.delete(player1Id);
    activeDuels.delete(player2Id);

    const p1 = getPlayerFromCache(player1Id);
    const p2 = getPlayerFromCache(player2Id);

    if (p1) {
        sendMessage('§eDuel timed out. Money refunded.', p1);
    }
    if (p2) {
        sendMessage('§eDuel timed out. Money refunded.', p2);
    }
}

export function handlePvPDeath(victim: mc.Player, killer: mc.Player): boolean {
    const duel = activeDuels.get(victim.id);

    if (!duel || duel.opponentId !== killer.id) {
        return false;
    }

    const config = getEconomyConfig().pvp;
    const { amount, timeoutId } = duel;

    mc.system.clearRun(timeoutId);
    activeDuels.delete(victim.id);
    activeDuels.delete(killer.id);

    if (amount > 0) {
        const winnings = amount * 2;
        incrementPlayerBalance(killer.id, winnings);
        sendMessage(`§6VICTORY! §aYou won the duel and earned ${formatCurrency(winnings)}!`, killer);
        sendMessage(`§cDEFEAT! §7You lost the duel and ${formatCurrency(amount)}.`, victim);
    } else {
        const victimData = getPlayer(victim.id);
        if (!victimData) {
            return true;
        }

        const stealPercent = config.defaultWinPercent;
        let winnings = Math.floor(victimData.balance * (stealPercent / 100));

        if (winnings > 0) {
            winnings = Math.min(winnings, victimData.balance);
            if (winnings > 0) {
                incrementPlayerBalance(victim.id, -winnings);
                incrementPlayerBalance(killer.id, winnings);
            }
        }

        sendMessage(`§6VICTORY! §aYou won the duel and took ${formatCurrency(winnings)} (${stealPercent}%) from your opponent!`, killer);
        sendMessage(`§cDEFEAT! §7You lost the duel and ${formatCurrency(winnings)} was taken from you.`, victim);
    }

    return true;
}

export function isInDuel(playerId: string): boolean {
    return activeDuels.has(playerId);
}
