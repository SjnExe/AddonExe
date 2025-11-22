import * as mc from '@minecraft/server';
import { getPlayer, incrementPlayerBalance } from './playerDataManager.js';
import { getEconomyConfig } from './configurations.js';
import { sendMessage } from './messaging.js';
import { formatCurrency } from './utils.js';

// Maps
// Request: Key = targetId, Value = { requesterId, amount, timestamp, timeoutId }
const pvpRequests = new Map();
// Duel: Key = playerId, Value = { opponentId, amount, startTime, timeoutId }
// Note: Both players will have an entry in activeDuels pointing to each other.
const activeDuels = new Map();

/**
 * Initiates a PvP request.
 * @param {import('@minecraft/server').Player} requester
 * @param {import('@minecraft/server').Player} target
 * @param {number} amount
 */
export function requestPvP(requester, target, amount) {
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
    if (amount > 0 && pData.balance < amount) {
        sendMessage(`§cYou do not have enough money. Required: ${formatCurrency(amount)}`, requester);
        return;
    }

    // Deduct money from requester if wager
    if (amount > 0) {
        incrementPlayerBalance(requester.id, -amount);
    }

    // Set timeout
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
    sendMessage(`§eType §a/pvp accept§e to accept or §c/pvp deny§e to deny. Request expires in ${config.requestTimeout} seconds.`, target);
}

/**
 * Accepts a pending PvP request.
 * @param {import('@minecraft/server').Player} player
 */
export function acceptPvP(player) {
    const request = pvpRequests.get(player.id);
    if (!request) {
        sendMessage('§cYou have no pending PvP requests.', player);
        return;
    }

    const config = getEconomyConfig().pvp;
    const { requesterId, amount } = request;

    // Verify requester is still online
    const requester = mc.world.getAllPlayers().find(p => p.id === requesterId);
    if (!requester) {
        sendMessage('§cThe challenger is no longer online. Refund issued to them.', player);
        // Refund is handled by logic that tracks offline players?
        // For simplicity, we assume requester data is loaded and refund them.
        if (amount > 0) {
            incrementPlayerBalance(requesterId, amount);
        }
        clearRequest(player.id);
        return;
    }

    // Check acceptor balance
    const pData = getPlayer(player.id);
    if (amount > 0 && pData.balance < amount) {
        sendMessage(`§cYou do not have enough money to accept. Required: ${formatCurrency(amount)}`, player);
        return;
    }

    // Deduct from acceptor
    if (amount > 0) {
        incrementPlayerBalance(player.id, -amount);
    }

    // Start Duel
    mc.system.clearRun(request.timeoutId);
    pvpRequests.delete(player.id);

    const duelTimeoutId = mc.system.runTimeout(() => {
        timeoutDuel(player.id, requester.id);
    }, config.duelTimeout * 20);

    const duelData = {
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
 * @param {import('@minecraft/server').Player} player
 */
export function denyPvP(player) {
    const request = pvpRequests.get(player.id);
    if (!request) {
        sendMessage('§cYou have no pending PvP requests.', player);
        return;
    }

    const { requesterId, amount } = request;

    // Refund requester
    if (amount > 0) {
        incrementPlayerBalance(requesterId, amount);
        const requester = mc.world.getAllPlayers().find(p => p.id === requesterId);
        if (requester) {
            sendMessage(`§c${player.name} denied your duel request. Money refunded.`, requester);
        }
    }

    clearRequest(player.id);
    sendMessage('§aDuel request denied.', player);
}

function clearRequest(targetId) {
    const request = pvpRequests.get(targetId);
    if (request) {
        mc.system.clearRun(request.timeoutId);
        pvpRequests.delete(targetId);
    }
}

function expireRequest(targetId) {
    const request = pvpRequests.get(targetId);
    if (!request) {return;}

    const { requesterId, amount } = request;

    // Refund
    if (amount > 0) {
        incrementPlayerBalance(requesterId, amount);
        const requester = mc.world.getAllPlayers().find(p => p.id === requesterId);
        if (requester) {
            sendMessage('§cPvP request expired and was refunded.', requester);
        }
    }

    const target = mc.world.getAllPlayers().find(p => p.id === targetId);
    if (target) {
        sendMessage('§cPvP request expired.', target);
    }

    pvpRequests.delete(targetId);
}

function timeoutDuel(player1Id, player2Id) {
    const duel = activeDuels.get(player1Id);
    if (!duel) {return;}

    const { amount } = duel;

    // Refund both
    if (amount > 0) {
        incrementPlayerBalance(player1Id, amount);
        incrementPlayerBalance(player2Id, amount);
    }

    activeDuels.delete(player1Id);
    activeDuels.delete(player2Id);

    const p1 = mc.world.getAllPlayers().find(p => p.id === player1Id);
    const p2 = mc.world.getAllPlayers().find(p => p.id === player2Id);

    if (p1) {sendMessage('§eDuel timed out. Money refunded.', p1);}
    if (p2) {sendMessage('§eDuel timed out. Money refunded.', p2);}
}

/**
 * Handles player death in context of PvP.
 * @param {import('@minecraft/server').Player} victim
 * @param {import('@minecraft/server').Player} killer
 * @returns {boolean} True if it was a duel death.
 */
export function handlePvPDeath(victim, killer) {
    const duel = activeDuels.get(victim.id);

    if (!duel || duel.opponentId !== killer.id) {
        return false; // Not a registered duel between these two
    }

    const config = getEconomyConfig().pvp;
    const { amount, timeoutId } = duel;

    mc.system.clearRun(timeoutId);
    activeDuels.delete(victim.id);
    activeDuels.delete(killer.id);

    let winnings = 0;

    if (amount > 0) {
        // Wager mode: Winner gets pot (2 * amount)
        winnings = amount * 2;
        incrementPlayerBalance(killer.id, winnings);
        sendMessage(`§6VICTORY! §aYou won the duel and earned ${formatCurrency(winnings)}!`, killer);
        sendMessage(`§cDEFEAT! §7You lost the duel and ${formatCurrency(amount)}.`, victim);
    } else {
        // No wager: Steal/Balance Percentage mode
        const victimData = getPlayer(victim.id);
        const stealPercent = config.defaultWinPercent ?? 100;
        winnings = Math.floor(victimData.balance * (stealPercent / 100));

        if (winnings > 0) {
            // Check if victim has enough (they should, but robust check)
            // But we should cap at actual balance
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

/**
 * Checks if a player is in a duel.
 * @param {string} playerId
 * @returns {boolean}
 */
export function isInDuel(playerId) {
    return activeDuels.has(playerId);
}
