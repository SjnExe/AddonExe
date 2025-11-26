import * as mc from '@minecraft/server';

import { getEconomyConfig } from './configurations.js';
import { sendMessage } from './messaging.js';
import { getPlayerFromCache } from './playerCache.js';
import { getPlayer, incrementPlayerBalance } from './playerDataManager.js';
import { formatCurrency } from './utils.js';

// --- Interfaces --- //

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

// --- Maps --- //

// Request: Key = targetId, Value = PvpRequest
const pvpRequests = new Map<string, PvpRequest>();
// Duel: Key = playerId, Value = ActiveDuel (Both players have an entry)
const activeDuels = new Map<string, ActiveDuel>();

/**
 * Initiates a PvP request.
 */
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
        amount: amount,
        timestamp: Date.now(),
        timeoutId: timeoutId
    });

    sendMessage(`§aPvP request sent to ${target.name} for ${formatCurrency(amount)}.`, requester);
    sendMessage(`§e${requester.name}§r has challenged you to a PvP duel for §6${formatCurrency(amount)}§r.`, target);
    sendMessage(
        `§eType §a/pvp accept§e to accept or §c/pvp deny§e to deny. Request expires in ${config.requestTimeout} seconds.`,
        target
    );
}

/**
 * Accepts a pending PvP request.
 */
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
        clearRequest(player.id, false); // Don't notify the requester, they're offline
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
        amount: amount,
        startTime: Date.now(),
        timeoutId: duelTimeoutId
    };

    activeDuels.set(player.id, { opponentId: requester.id, ...duelData });
    activeDuels.set(requester.id, { opponentId: player.id, ...duelData });

    sendMessage('§aDuel accepted! Fight!', player);
    sendMessage(`§a${player.name} accepted the duel! Fight!`, requester);
}

/**
 * Denies a pending PvP request.
 */
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
    if (!request) return;

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
    if (!request) return;

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
    if (!duel) return;

    const { amount } = duel;

    if (amount > 0) {
        incrementPlayerBalance(player1Id, amount);
        incrementPlayerBalance(player2Id, amount);
    }

    activeDuels.delete(player1Id);
    activeDuels.delete(player2Id);

    const p1 = getPlayerFromCache(player1Id);
    const p2 = getPlayerFromCache(player2Id);

    if (p1) sendMessage('§eDuel timed out. Money refunded.', p1);
    if (p2) sendMessage('§eDuel timed out. Money refunded.', p2);
}

/**
 * Handles player death in the context of PvP.
 * @returns True if it was a duel death and was handled.
 */
export function handlePvPDeath(victim: mc.Player, killer: mc.Player): boolean {
    const duel = activeDuels.get(victim.id);

    if (!duel || duel.opponentId !== killer.id) {
        return false; // Not a registered duel between these two
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
        if (!victimData) return true; // Victim data gone, can't proceed

        const stealPercent = config.defaultWinPercent ?? 100;
        let winnings = Math.floor(victimData.balance * (stealPercent / 100));

        if (winnings > 0) {
            winnings = Math.min(winnings, victimData.balance);
            if (winnings > 0) {
                incrementPlayerBalance(victim.id, -winnings);
                incrementPlayerBalance(killer.id, winnings);
            }
        }

        sendMessage(
            `§6VICTORY! §aYou won the duel and took ${formatCurrency(winnings)} (${stealPercent}%) from your opponent!`,
            killer
        );
        sendMessage(`§cDEFEAT! §7You lost the duel and ${formatCurrency(winnings)} was taken from you.`, victim);
    }

    return true;
}

/**
 * Checks if a player is in a duel.
 */
export function isInDuel(playerId: string): boolean {
    return activeDuels.has(playerId);
}
