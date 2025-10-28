/**
 * @typedef {object} HomeLocation
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} dimensionId
 */

/**
 * @typedef {object} PlayerData
 * @property {string} name - The player's last known in-game name.
 * @property {string} rankId
 * @property {number} permissionLevel
 * @property {Object.<string, HomeLocation>} homes
 * @property {number} balance
 * @property {Object.<string, number>} kitCooldowns
 * @property {boolean} xrayNotifications
 * @property {HomeLocation | null} lastDeathLocation
 * @property {boolean} deathNotificationSent
 * @property {boolean} tpaRequestsDisabled
 * @property {string[]} tpaBlockedPlayerIds
 * @property {boolean} announcementsMuted
 */

import { getConfig } from './configManager.js';
import { world, system } from '@minecraft/server';
import { debugLog, errorLog } from './logger.js';
import { getPlayerFromCache } from './playerCache.js';
import { registerPlaceholder } from './placeholderManager.js';

const playerPropertyPrefix = 'exe:player.';
const playerNameIdMapKey = 'exe:playerNameIdMap';
const leaderboardKey = 'exe:economyLeaderboard';

/**
 * @typedef {object} LeaderboardEntry
 * @property {string} playerId
 * @property {string} name
 * @property {number} balance
 */

/** @type {LeaderboardEntry[]} */
let leaderboardCache = [];
let isLeaderboardDirty = false;
let isSaveOnCooldown = false;

/** @type {Map<string, PlayerData>} */
const activePlayerData = new Map();

/** @type {Map<string, string>} */
let playerNameIdMap = new Map();
let playerIdNameMap = new Map();

/** A flag indicating that the name-to-ID map has changed and needs to be saved. */
export let isNameIdMapDirty = false;

/**
 * Defines the default structure and values for a new player.
 * This is used to ensure all properties exist, especially for backwards compatibility.
 * @type {Omit<PlayerData, 'name' | 'homes' | 'kitCooldowns' | 'tpaBlockedPlayerIds'>}
 */
const defaultPlayerData = {
    rankId: 'member',
    permissionLevel: 1024,
    balance: 0,
    xrayNotifications: true,
    lastDeathLocation: null,
    deathNotificationSent: true,
    tpaRequestsDisabled: false,
    announcementsMuted: false
};


// --- Generic Data Handling ---

/**
 * A generic function to update a player's data. It handles getting the data,
 * running a modification callback, and saving the data.
 * @param {string} playerId The ID of the player to update.
 * @param {(pData: PlayerData) => void} modificationCallback A callback that receives the player data and modifies it.
 */
function updatePlayerData(playerId, modificationCallback) {
    const pData = getPlayer(playerId);
    if (pData) {
        modificationCallback(pData);
        savePlayerData(playerId);
    }
}

/**
 * Resets all in-memory caches and state variables.
 */
export function cleanupPlayerDataManager() {
    leaderboardCache = [];
    isLeaderboardDirty = false;
    isSaveOnCooldown = false;
    activePlayerData.clear();
    playerNameIdMap.clear();
    playerIdNameMap.clear();
    isNameIdMapDirty = false;
    debugLog('[PlayerDataManager] All in-memory caches have been cleared.');
}

/**
 * Saves the player name-to-ID map to a dynamic property.
 */
export function saveNameIdMap() {
    try {
        const dataToSave = Array.from(playerNameIdMap.entries());
        world.setDynamicProperty(playerNameIdMapKey, JSON.stringify(dataToSave));
        isNameIdMapDirty = false;
        debugLog('[PlayerDataManager] Saved name-to-ID map.');
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save name-to-ID map: ${e.stack}`);
    }
}

export function loadNameIdMap() {
    try {
        const dataString = world.getDynamicProperty(playerNameIdMapKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData = JSON.parse(dataString);
            playerNameIdMap = new Map(parsedData);
            debugLog(`[PlayerDataManager] Loaded ${playerNameIdMap.size} entries into name-to-ID map.`);
        }
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to load name-to-ID map: ${e.stack}`);
    }
}

/**
 * Saves a single player's data to a unique dynamic property.
 * @param {string} playerId The ID of the player to save.
 */
export function savePlayerData(playerId) {
    if (!activePlayerData.has(playerId)) {
        errorLog(`[PlayerDataManager] Attempted to save data for non-cached player: ${playerId}`);
        return;
    }
    try {
        const playerData = activePlayerData.get(playerId);
        const dataString = JSON.stringify(playerData);
        world.setDynamicProperty(`${playerPropertyPrefix}${playerId}`, dataString);
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save data for player ${playerId}: ${e.stack}`);
    }
}

/**
 * Loads a single player's data from their unique dynamic property into the cache.
 * @param {string} playerId The ID of the player to load.
 * @returns {PlayerData | null} The loaded player data, or null if not found.
 */
export function loadPlayerData(playerId) {
    try {
        const dataString = world.getDynamicProperty(`${playerPropertyPrefix}${playerId}`);
        if (dataString && typeof dataString === 'string') {
            /** @type {Partial<PlayerData>} */
            const loadedData = JSON.parse(dataString);

            // Merge with defaults to ensure all properties exist
            const playerData = {
                ...defaultPlayerData,
                homes: {},
                kitCooldowns: {},
                tpaBlockedPlayerIds: [],
                ...loadedData
            };

            activePlayerData.set(playerId, playerData);
            return playerData;
        }
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to load data for player ${playerId}: ${e.stack}`);
    }
    return null;
}

/**
 * Gets a player's data from the cache, or loads/creates it if it doesn't exist.
 * @param {import('@minecraft/server').Player} player
 * @returns {PlayerData}
 */
export function getOrCreatePlayer(player) {
    const playerNameLower = player.name.toLowerCase();
    let mapWasModified = false;

    if (playerNameIdMap.get(playerNameLower) !== player.id) {
        const oldName = playerIdNameMap.get(player.id);
        if (oldName) {
            playerNameIdMap.delete(oldName.toLowerCase());
        }
        playerNameIdMap.set(playerNameLower, player.id);
        playerIdNameMap.set(player.id, player.name);
        mapWasModified = true;
    }

    if (mapWasModified) {
        isNameIdMapDirty = true;
    }

    if (activePlayerData.has(player.id)) {
        const pData = activePlayerData.get(player.id);
        if (pData.name !== player.name) {
            updatePlayerData(player.id, data => { data.name = player.name; });
        }
        return pData;
    }

    const loadedData = loadPlayerData(player.id);
    if (loadedData) {
        if (loadedData.name !== player.name) {
            updatePlayerData(player.id, data => { data.name = player.name; });
        }
        return loadedData;
    }

    const config = getConfig();
    const newPlayerData = {
        name: player.name,
        ...defaultPlayerData,
        rankId: config.playerDefaults.rankId,
        permissionLevel: config.playerDefaults.permissionLevel,
        balance: config.economy.startingBalance,
        xrayNotifications: config.playerDefaults.xrayNotifications,
        homes: {},
        kitCooldowns: {},
        tpaBlockedPlayerIds: []
    };

    activePlayerData.set(player.id, newPlayerData);
    savePlayerData(player.id);
    return newPlayerData;
}

/**
 * Gets a player's ID from their name via the lookup map.
 * @param {string} playerName The name of the player.
 * @returns {string | undefined} The player's ID, or undefined if not found.
 */
export function getPlayerIdByName(playerName) {
    return playerNameIdMap.get(playerName.toLowerCase());
}

/**
 * Gets a player's data from the in-memory cache.
 * @param {string} playerId
 * @returns {PlayerData | undefined}
 */
export function getPlayer(playerId) {
    return activePlayerData.get(playerId);
}

/**
 * Handles a player leaving the server by removing them from the cache.
 * @param {string} playerId
 */
export function handlePlayerLeave(playerId) {
    if (activePlayerData.has(playerId)) {
        activePlayerData.delete(playerId);
        debugLog(`[PlayerDataManager] Unloaded data for player ${playerId} from cache.`);
    }
}

/**
 * Gets all active (online) player data from the cache.
 * @returns {Map<string, PlayerData>}
 */
export function getAllPlayerData() {
    return activePlayerData;
}

/**
 * Gets the map of all known player names and their corresponding IDs.
 * @returns {Map<string, string>}
 */
export function getAllPlayerNameIdMap() {
    return playerNameIdMap;
}

// --- Leaderboard Management ---

export function getLeaderboard() {
    return leaderboardCache;
}

export function initializeLeaderboard() {
    try {
        const dataString = world.getDynamicProperty(leaderboardKey);
        if (dataString && typeof dataString === 'string') {
            leaderboardCache = JSON.parse(dataString);
            debugLog(`[PlayerDataManager] Loaded ${leaderboardCache.length} players into leaderboard cache.`);
            return;
        }
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to load leaderboard from storage: ${e.stack}`);
    }
    leaderboardCache = [];
}

function triggerLeaderboardSave() {
    if (isSaveOnCooldown) {
        isLeaderboardDirty = true;
        return;
    }
    try {
        world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        isLeaderboardDirty = false;
        isSaveOnCooldown = true;
        system.runTimeout(() => {
            isSaveOnCooldown = false;
            if (isLeaderboardDirty) {
                triggerLeaderboardSave();
            }
        }, 30 * 20);
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save leaderboard: ${e.stack}`);
    }
}

function updateAndSaveLeaderboard(playerId, pData) {
    const config = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    const lowestBalanceOnBoard = leaderboardCache.length < cacheSize ? 0 : (leaderboardCache[leaderboardCache.length - 1]?.balance ?? 0);
    const existingIndex = leaderboardCache.findIndex(p => p.playerId === playerId);
    const playerIsOnBoard = existingIndex !== -1;

    if (!playerIsOnBoard && pData.balance <= lowestBalanceOnBoard) {return;}

    if (playerIsOnBoard) {
        if (leaderboardCache[existingIndex].balance === pData.balance) {return;}
        leaderboardCache.splice(existingIndex, 1);
    }

    leaderboardCache.push({ playerId: playerId, name: pData.name, balance: pData.balance });
    leaderboardCache.sort((a, b) => b.balance - a.balance);

    if (leaderboardCache.length > cacheSize) {
        leaderboardCache.length = cacheSize;
    }
    triggerLeaderboardSave();
}


// --- Pending Payment Management ---

/**
 * @typedef {object} PendingPayment
 * @property {string} sourcePlayerId
 * @property {string} targetPlayerId
 * @property {number} amount
 * @property {number} timestamp
 */

/** @type {Map<string, PendingPayment>} */
const pendingPayments = new Map();

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
            const player = getPlayerFromCache(playerId);
            if (player) {
                player.sendMessage('§cYour pending payment has expired.');
            }
        }
    }
}


// --- Dimension Lock State Management ---

const netherLockKey = 'exe:dimensionLock_nether';
const endLockKey = 'exe:dimensionLock_end';

export function getLockState(dimension) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        return !!world.getDynamicProperty(key);
    } catch { return false; }
}

export function setLockState(dimension, isLocked) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        world.setDynamicProperty(key, isLocked);
    } catch {
        errorLog(`[DimensionLock] Failed to set lock state for ${dimension}.`);
    }
}

// --- Data Modification Wrappers ---

export function setPlayerRank(playerId, rankId, permissionLevel) {
    updatePlayerData(playerId, pData => {
        pData.rankId = rankId;
        pData.permissionLevel = permissionLevel;
    });
}

export function setPlayerAnnouncementsMuted(playerId, isMuted) {
    updatePlayerData(playerId, pData => { pData.announcementsMuted = isMuted; });
}

export function setTpaRequestsDisabled(playerId, isDisabled) {
    updatePlayerData(playerId, pData => { pData.tpaRequestsDisabled = isDisabled; });
}

export function addTpaBlockedPlayer(playerId, blockedPlayerId) {
    updatePlayerData(playerId, pData => {
        if (!pData.tpaBlockedPlayerIds.includes(blockedPlayerId)) {
            pData.tpaBlockedPlayerIds.push(blockedPlayerId);
        }
    });
}

export function removeTpaBlockedPlayer(playerId, unblockedPlayerId) {
    updatePlayerData(playerId, pData => {
        pData.tpaBlockedPlayerIds = pData.tpaBlockedPlayerIds.filter(id => id !== unblockedPlayerId);
    });
}

export function setPlayerHome(playerId, homeName, location) {
    updatePlayerData(playerId, pData => { pData.homes[homeName] = location; });
}

export function deletePlayerHome(playerId, homeName) {
    updatePlayerData(playerId, pData => { delete pData.homes[homeName]; });
}

export function setPlayerBalance(playerId, newBalance) {
    updatePlayerData(playerId, pData => {
        pData.balance = newBalance;
        updateAndSaveLeaderboard(playerId, pData);
    });
}

export function incrementPlayerBalance(playerId, amount) {
    updatePlayerData(playerId, pData => {
        pData.balance += amount;
        updateAndSaveLeaderboard(playerId, pData);
    });
}

export function setKitCooldown(playerId, kitName, timestamp) {
    updatePlayerData(playerId, pData => { pData.kitCooldowns[kitName] = timestamp; });
}

export function setPlayerXrayNotifications(playerId, status) {
    updatePlayerData(playerId, pData => { pData.xrayNotifications = status; });
}

export function setPlayerLastDeathLocation(playerId, location) {
    updatePlayerData(playerId, pData => {
        pData.lastDeathLocation = location;
        if (location) {
            pData.deathNotificationSent = false;
        }
    });
}

export function setDeathNotificationSent(playerId, status) {
    updatePlayerData(playerId, pData => { pData.deathNotificationSent = status; });
}

// --- Economy Specific Logic ---

export function getBalance(playerId) {
    const pData = getPlayer(playerId);
    return pData?.balance ?? null;
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

    incrementPlayerBalance(sourcePlayerId, -amount);
    incrementPlayerBalance(targetPlayerId, amount);

    return { success: true, message: 'Transfer successful.' };
}

export function registerPlayerDataPlaceholders() {
    registerPlaceholder('topbal', ({ index, valueKey }) => {
        // The getLeaderboard function does not take any arguments. It always returns the balance leaderboard.
        const leaderboard = getLeaderboard();

        // Validate leaderboard data and index
        if (!Array.isArray(leaderboard) || index < 0 || index >= leaderboard.length) {
            return '';
        }

        const playerData = leaderboard[index];

        // Validate player data object
        if (!playerData || typeof playerData !== 'object') {
            return '';
        }

        if (valueKey === 'name') {
            return playerData.name ?? ''; // Nullish coalescing for safety
        }
        if (valueKey === 'value') {
            return String(playerData.balance ?? '0'); // Nullish coalescing for safety
        }

        return '';
    });
}