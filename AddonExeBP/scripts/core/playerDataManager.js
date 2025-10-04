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
 */

import { getConfig } from './configManager.js';
import { world, system } from '@minecraft/server';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';

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

/**
 * @type {Map<string, PlayerData>}
 */
const activePlayerData = new Map();

/**
 * @type {Map<string, string>}
 */
let playerNameIdMap = new Map();
let playerIdNameMap = new Map();

/** A flag indicating that the name-to-ID map has changed and needs to be saved. */
export let isNameIdMapDirty = false;

/**
 * Resets all in-memory caches and state variables.
 * This is crucial for ensuring a clean state after a script reload.
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
        isNameIdMapDirty = false; // Reset the flag after saving
        debugLog('[PlayerDataManager] Saved name-to-ID map.');
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save name-to-ID map: ${e.stack}`);
    }
}

/**
 * Loads the player name-to-ID map from a dynamic property.
 */
export function getLeaderboard() {
    return leaderboardCache;
}

/**
 * Loads the leaderboard from storage, or generates it if it doesn't exist.
 */
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

    // If loading failed or it doesn't exist, initialize an empty one.
    // The leaderboard will be populated as players join and their balances are updated.
    debugLog('[PlayerDataManager] No leaderboard found in storage, initializing an empty one.');
    leaderboardCache = [];
    // No need to save it immediately, it will be saved when it's first updated.
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

function triggerLeaderboardSave() {
    if (isSaveOnCooldown) {
        isLeaderboardDirty = true;
        return;
    }

    try {
        world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        debugLog('[PlayerDataManager] Saved leaderboard to storage.');
        isLeaderboardDirty = false;
        isSaveOnCooldown = true;

        system.runTimeout(() => {
            isSaveOnCooldown = false;
            if (isLeaderboardDirty) {
                triggerLeaderboardSave();
            }
        }, 30 * 20); // 30-second cooldown
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save leaderboard: ${e.stack}`);
    }
}

/**
 * Updates the leaderboard if the player's new balance qualifies them.
 * @param {string} playerId
 * @param {PlayerData} pData
 */
function updateAndSaveLeaderboard(playerId, pData) {
    const config = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    const lowestBalanceOnBoard = leaderboardCache.length < cacheSize ? 0 : (leaderboardCache[leaderboardCache.length - 1]?.balance ?? 0);

    const existingIndex = leaderboardCache.findIndex(p => p.playerId === playerId);
    const playerIsOnBoard = existingIndex !== -1;

    // Case 1: Player is not on the board and their balance is too low to get on.
    if (!playerIsOnBoard && pData.balance <= lowestBalanceOnBoard) {
        return; // No update needed.
    }

    // Case 2: Player is on the board.
    if (playerIsOnBoard) {
        const oldEntry = leaderboardCache[existingIndex];
        // If balance hasn't changed, do nothing.
        if (oldEntry.balance === pData.balance) {
            return;
        }
        // Update the balance and re-sort. A resort is needed in case their rank changed.
        leaderboardCache.splice(existingIndex, 1);
        leaderboardCache.push({ playerId: playerId, name: pData.name, balance: pData.balance });
        leaderboardCache.sort((a, b) => b.balance - a.balance);
        triggerLeaderboardSave();
        return;
    }

    // Case 3: Player is not on the board but has enough balance to get on.
    if (!playerIsOnBoard && pData.balance > lowestBalanceOnBoard) {
        leaderboardCache.push({ playerId: playerId, name: pData.name, balance: pData.balance });
        leaderboardCache.sort((a, b) => b.balance - a.balance);
        // Trim the cache to the correct size
        if (leaderboardCache.length > cacheSize) {
            leaderboardCache.length = cacheSize;
        }
        triggerLeaderboardSave();
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
            /** @type {PlayerData} */
            const playerData = JSON.parse(dataString);

            // Backwards compatibility: Add new properties if they don't exist
            if (playerData.tpaRequestsDisabled === undefined) {
                playerData.tpaRequestsDisabled = false;
            }
            if (playerData.tpaBlockedPlayerIds === undefined) {
                playerData.tpaBlockedPlayerIds = [];
            }

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

    // Check if the current name is correctly mapped
    if (playerNameIdMap.get(playerNameLower) !== player.id) {
        // Clean up old usernames for this player ID from both maps
        const oldName = playerIdNameMap.get(player.id);
        if (oldName) {
            playerNameIdMap.delete(oldName.toLowerCase());
            debugLog(`[PlayerDataManager] Removed old username '${oldName}' for player ID ${player.id}.`);
        }

        playerNameIdMap.set(playerNameLower, player.id);
        playerIdNameMap.set(player.id, player.name); // Store the proper-cased name
        mapWasModified = true;
    }

    if (mapWasModified) {
        isNameIdMapDirty = true;
    }

    if (activePlayerData.has(player.id)) {
        const pData = activePlayerData.get(player.id);
        // Update name if it has changed since last join
        if (pData.name !== player.name) {
            pData.name = player.name;
            savePlayerData(player.id); // Save immediately
        }
        return pData;
    }

    // Try to load from dynamic properties first
    const loadedData = loadPlayerData(player.id);
    if (loadedData) {
        // Also check for name change on first load of session
        if (loadedData.name !== player.name) {
            loadedData.name = player.name;
            savePlayerData(player.id);
        }
        return loadedData;
    }

    // If still not found, create new data
    const config = getConfig();
    const newPlayerData = {
        name: player.name,
        rankId: config.playerDefaults.rankId,
        permissionLevel: config.playerDefaults.permissionLevel,
        homes: {},
        balance: config.economy.startingBalance,
        kitCooldowns: {},
        xrayNotifications: config.playerDefaults.xrayNotifications,
        lastDeathLocation: null,
        deathNotificationSent: true, // Default to true to prevent message on first spawn
        tpaRequestsDisabled: false,
        tpaBlockedPlayerIds: []
    };
    activePlayerData.set(player.id, newPlayerData);
    savePlayerData(player.id); // Save immediately
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
 * Handles a player leaving the server by saving their data and removing them from the cache.
 * @param {string} playerId
 */
export function handlePlayerLeave(playerId) {
    const pData = activePlayerData.get(playerId);
    if (pData) {
        // Data is now saved immediately on modification,
        // so we just need to remove the player from the active cache on leave.
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


// --- Dimension Lock State Management ---

const netherLockKey = 'exe:dimensionLock_nether';
const endLockKey = 'exe:dimensionLock_end';

/**
 * Gets the lock state for a given dimension.
 * @param {'nether' | 'end'} dimension
 * @returns {boolean}
 */
export function getLockState(dimension) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        // Returns the value of the property, or undefined if it doesn't exist.
        // Coerce to boolean.
        return !!world.getDynamicProperty(key);
    } catch {
        // Property probably doesn't exist yet
        return false;
    }
}

/**
 * Sets the lock state for a given dimension.
 * @param {'nether' | 'end'} dimension
 * @param {boolean} isLocked
 */
export function setLockState(dimension, isLocked) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        world.setDynamicProperty(key, isLocked);
    } catch {
        errorLog(`[DimensionLock] Failed to set lock state for ${dimension}.`);
    }
}


// --- Data Modification Wrappers ---
// These functions now save data immediately after modification.

/**
 * Updates a player's rank and permission level.
 * @param {string} playerId
 * @param {string} rankId
 * @param {number} permissionLevel
 */
export function setPlayerRank(playerId, rankId, permissionLevel) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.rankId = rankId;
        pData.permissionLevel = permissionLevel;
        savePlayerData(playerId);
    }
}

/**
 * Sets whether a player's TPA requests are disabled.
 * @param {string} playerId The ID of the player to modify.
 * @param {boolean} isDisabled The new disabled state.
 */
export function setTpaRequestsDisabled(playerId, isDisabled) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.tpaRequestsDisabled = isDisabled;
        savePlayerData(playerId);
    }
}

/**
 * Adds a player to another player's TPA block list.
 * @param {string} playerId The ID of the player whose block list is being modified.
 * @param {string} blockedPlayerId The ID of the player to block.
 */
export function addTpaBlockedPlayer(playerId, blockedPlayerId) {
    const pData = getPlayer(playerId);
    if (pData && !pData.tpaBlockedPlayerIds.includes(blockedPlayerId)) {
        pData.tpaBlockedPlayerIds.push(blockedPlayerId);
        savePlayerData(playerId);
    }
}

/**
 * Removes a player from another player's TPA block list.
 * @param {string} playerId The ID of the player whose block list is being modified.
 * @param {string} unblockedPlayerId The ID of the player to unblock.
 */
export function removeTpaBlockedPlayer(playerId, unblockedPlayerId) {
    const pData = getPlayer(playerId);
    if (pData && pData.tpaBlockedPlayerIds.includes(unblockedPlayerId)) {
        pData.tpaBlockedPlayerIds = pData.tpaBlockedPlayerIds.filter(id => id !== unblockedPlayerId);
        savePlayerData(playerId);
    }
}

/**
 * Sets or updates a player's home location.
 * @param {string} playerId
 * @param {string} homeName
 * @param {HomeLocation} location
 */
export function setPlayerHome(playerId, homeName, location) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.homes[homeName] = location;
        savePlayerData(playerId);
    }
}

/**
 * Deletes a player's home.
 * @param {string} playerId
 * @param {string} homeName
 */
export function deletePlayerHome(playerId, homeName) {
    const pData = getPlayer(playerId);
    if (pData && pData.homes[homeName]) {
        delete pData.homes[homeName];
        savePlayerData(playerId);
    }
}

/**
 * Sets a player's balance to a specific value.
 * @param {string} playerId
 * @param {number} newBalance
 */
export function setPlayerBalance(playerId, newBalance) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.balance = newBalance;
        savePlayerData(playerId);
        updateAndSaveLeaderboard(playerId, pData);
    }
}

/**
 * Adds or removes from a player's balance.
 * @param {string} playerId
 * @param {number} amount The amount to add (can be negative).
 */
export function incrementPlayerBalance(playerId, amount) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.balance += amount;
        savePlayerData(playerId);
        updateAndSaveLeaderboard(playerId, pData);
    }
}

/**
 * Sets a cooldown for a kit for a player.
 * @param {string} playerId
 * @param {string} kitName
 * @param {number} timestamp The timestamp when the cooldown expires.
 */
export function setKitCooldown(playerId, kitName, timestamp) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.kitCooldowns[kitName] = timestamp;
        savePlayerData(playerId);
    }
}

/**
 * Toggles whether a player receives X-ray notifications.
 * @param {string} playerId
 * @param {boolean} status
 */
export function setPlayerXrayNotifications(playerId, status) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.xrayNotifications = status;
        savePlayerData(playerId);
    }
}

/**
 * Sets a player's last death location.
 * @param {string} playerId
 * @param {HomeLocation | null} location
 */
export function setPlayerLastDeathLocation(playerId, location) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.lastDeathLocation = location;
        // If a new location is being set, it means the player has died,
        // so we need to reset the notification flag.
        if (location) {
            pData.deathNotificationSent = false;
        }
        savePlayerData(playerId);
    }
}

/**
 * Sets the flag indicating whether the death notification has been sent.
 * @param {string} playerId
 * @param {boolean} status
 */
export function setDeathNotificationSent(playerId, status) {
    const pData = getPlayer(playerId);
    if (pData) {
        pData.deathNotificationSent = status;
        savePlayerData(playerId);
    }
}
