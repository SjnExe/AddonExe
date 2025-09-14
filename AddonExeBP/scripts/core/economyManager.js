import { getPlayer, setPlayerBalance, incrementPlayerBalance, getOrCreatePlayer } from './playerDataManager.js';
import { getPlayerFromCache } from './playerCache.js';
import { getConfig } from './configManager.js';

/**
 * @typedef {object} PendingPayment
 * @property {string} sourcePlayerId
 * @property {string} targetPlayerId
 * @property {number} amount
 * @property {number} timestamp
 */

/**
 * @type {Map<string, PendingPayment>}
 */
const pendingPayments = new Map();

// --- Pending Payment Management ---

export function createPendingPayment(sourcePlayerId, targetPlayerId, amount) {
    pendingPayments.set(sourcePlayerId, {
        sourcePlayerId,
        targetPlayerId,
        amount,
        timestamp: Date.now()
    });
}

export function getPendingPayment(sourcePlayerId) {
    return pendingPayments.get(sourcePlayerId);
}

export function clearPendingPayment(sourcePlayerId) {
    pendingPayments.delete(sourcePlayerId);
}

export function clearExpiredPayments() {
    const config = getConfig();
    const timeout = config.economy.paymentConfirmationTimeout * 1000; // convert to ms
    const now = Date.now();

    for (const [playerId, payment] of pendingPayments.entries()) {
        if (now - payment.timestamp > timeout) {
            pendingPayments.delete(playerId);
            const player = getPlayerFromCache(playerId); // Use cache instead of world.getPlayer
            if (player) {
                player.sendMessage('§cYour pending payment has expired.');
            }
        }
    }
}


// --- Balance Management ---

export function getBalance(playerId) {
    const pData = getPlayer(playerId);
    return pData?.balance ?? null;
}

export function setBalance(playerId, amount) {
    const pData = getPlayer(playerId);
    if (!pData || amount < 0) {
        return false;
    }
    setPlayerBalance(playerId, amount);
    return true;
}

export function addBalance(playerId, amount) {
    if (amount < 0) {return false;}
    const player = getPlayerFromCache(playerId);
    if (!player) {
        // This can happen if the player logs off in the same tick as the event.
        // Or if this is called for an offline player.
        // For now, we'll just fail silently. A more robust system might queue the payment.
        return false;
    }
    // Ensure data is loaded before trying to modify it
    getOrCreatePlayer(player);
    incrementPlayerBalance(playerId, amount);
    return true;
}

export function removeBalance(playerId, amount) {
    if (amount < 0) {return false;}
    const currentBalance = getBalance(playerId);
    if (currentBalance === null || currentBalance < amount) {
        return false;
    }
    incrementPlayerBalance(playerId, -amount);
    return true;
}

export function transfer(sourcePlayerId, targetPlayerId, amount) {
    if (amount <= 0) {
        return { success: false, message: 'Transfer amount must be positive.' };
    }
    const sourceData = getPlayer(sourcePlayerId);
    if (!sourceData) {
        return { success: false, message: 'Could not find your player data.' };
    }
    if (sourceData.balance < amount) {
        return { success: false, message: 'You do not have enough money for this transaction.' };
    }
    const targetData = getPlayer(targetPlayerId);
    if (!targetData) {
        return { success: false, message: 'Could not find the target player\'s data.' };
    }

    // Use the data wrappers to ensure dirty flags are set
    incrementPlayerBalance(sourcePlayerId, -amount);
    incrementPlayerBalance(targetPlayerId, amount);

    return { success: true, message: 'Transfer successful.' };
}
