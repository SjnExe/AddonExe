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
 * @property {boolean} [needsSave] - Internal flag for the auto-saver.
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

    // If loading failed or it doesn't exist, generate a new one.
    // This is a one-time, potentially slow operation on first run.
    debugLog('[PlayerDataManager] No leaderboard found in storage, generating a new one...');
    const allPlayersMap = getAllPlayerNameIdMap();
    const allEntries = [];
    const tempPlayerIdNameMap = new Map();

    for (const [name, id] of allPlayersMap.entries()) {
        const pData = loadPlayerData(id); // Load each player's data
        if (pData) {
            // Use the proper-cased name from the saved data
            const properName = pData.name ?? name;
            tempPlayerIdNameMap.set(id, properName);
            if (pData.balance > 0) {
                allEntries.push({ playerId: id, name: properName, balance: pData.balance });
            }
        }
    }

    // Set the global reverse map
    playerIdNameMap = tempPlayerIdNameMap;

    allEntries.sort((a, b) => b.balance - a.balance);
    const config = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    leaderboardCache = allEntries.slice(0, cacheSize);

    // Save the newly generated leaderboard
    try {
        world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        debugLog('[PlayerDataManager] Successfully generated and saved a new leaderboard.');
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save newly generated leaderboard: ${e.stack}`);
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
    const lowestBalanceOnBoard = leaderboardCache.length < cacheSize ? 0 : leaderboardCache[leaderboardCache.length - 1].balance;

    const playerIsOnBoard = leaderboardCache.some(p => p.playerId === playerId);

    if (!playerIsOnBoard && pData.balance <= lowestBalanceOnBoard) {
        // Player is not on the board and their balance isn't high enough to get on.
        return;
    }

    // Remove the player's old entry if it exists
    const existingIndex = leaderboardCache.findIndex(p => p.playerId === playerId);
    if (existingIndex !== -1) {
        leaderboardCache.splice(existingIndex, 1);
    }

    // Add the new entry and sort
    leaderboardCache.push({ playerId: playerId, name: pData.name, balance: pData.balance });
    leaderboardCache.sort((a, b) => b.balance - a.balance);

    // Trim the cache to the correct size
    if (leaderboardCache.length > cacheSize) {
        leaderboardCache.length = cacheSize;
    }

    triggerLeaderboardSave();
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
        // Don't save the internal 'needsSave' flag to disk
        // eslint-disable-next-line no-unused-vars
        const { needsSave, ...dataToSave } = playerData;
        const dataString = JSON.stringify(dataToSave);
        world.setDynamicProperty(`${playerPropertyPrefix}${playerId}`, dataString);
        // Mark the data as clean after a successful save
        if (playerData) {
            playerData.needsSave = false;
        }
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
            playerData.needsSave = false; // Loaded data is considered clean
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
            pData.needsSave = true;
        }
        return pData;
    }

    // Try to load from dynamic properties first
    const loadedData = loadPlayerData(player.id);
    if (loadedData) {
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
        needsSave: true // New data should be saved on the next cycle
    };
    activePlayerData.set(player.id, newPlayerData);
    // Do not save immediately, let the auto-saver handle it.
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
        // Only save if the data has been modified
        if (pData.needsSave) {
            savePlayerData(playerId);
        }
        activePlayerData.delete(playerId);
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


// --- Data Modification Wrappers ---
// These functions ensure that any data modification correctly
// flags the player's data to be saved by the auto-saver.

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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
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
        pData.needsSave = true;
    }
}
