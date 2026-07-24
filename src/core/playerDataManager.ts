import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getEconomyConfig } from '@core/configurations.js';
import { SerializedItem } from '@core/itemSerializer.js';
import { debugLog, errorLog, infoLog } from '@core/logger.js';
import { hasPermission } from '@core/permissionEngine.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/playerCache.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { formatCurrency } from '@core/utils/economy.js';
import { updateAndSaveLeaderboard } from '@features/economy/leaderboardManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

const playerPropertyPrefix = 'exe:player.';
// Legacy keys (kept for migration)
const playerNameIdMapKey = 'exe:playerNameIdMap';
const playerIdNameMapKey = 'exe:playerIdNameMap';

// Sharded keys
const playerNameIdMapShardPrefix = 'exe:nameIdMap_';
const playerIdNameMapShardPrefix = 'exe:idNameMap_';
const MAP_SHARD_SIZE = 200; // Entries per shard - reduced to prevent 32KB overflow

export interface HomeLocation {
    x: number;
    y: number;
    z: number;
    dimensionId: string;
}

export interface PendingInvite {
    teamId: number;
    teamName: string;
    timestamp: number;
}

export interface FriendRequest {
    senderId: string;
    senderName: string;
    timestamp: number;
}

export interface PlayerData {
    name: string;
    ranks: string[];
    rankId: string;
    homes: Record<string, HomeLocation>;
    balance: number;
    kitCooldowns: Record<string, number>;
    xrayNotificationsEnabled: boolean;
    lastDeathLocation: HomeLocation | undefined;
    lastLocation: HomeLocation | undefined;
    deathNotificationSent: boolean;
    tpaRequestsDisabled: boolean;
    tpaBlockedPlayerIds: string[];
    announcementsMuted: boolean;
    teamId: number | undefined;
    teamSettings: { autoTpAccept: boolean };
    pendingInvites: PendingInvite[];
    kills: number;
    deaths: number;
    killStreak: number;
    totalPlayTime: number; // Stored in milliseconds
    sidebarVisible: boolean;
    mailbox: SerializedItem[];
    lastDailyClaim: number;
    dailyStreak: number;
    starterKitClaimed: boolean;
    isVanished: boolean;
    friends?: string[];
    friendRequests?: FriendRequest[];
    friendSettings?: { autoTpAccept: boolean };
    needsSave?: boolean;
}

const activePlayerData = new Map<string, PlayerData>();
const sessionStartTimes = new Map<string, number>();

const playerNameIdMap = new Map<string, string>();
const playerIdNameMap = new Map<string, string>();

/** A flag indicating that the name-to-ID map has changed and needs to be saved. */
export let isNameIdMapDirty = false;

/**
 * Defines the default structure and values for a new player.
 */
const defaultPlayerData: Omit<PlayerData, 'name' | 'homes' | 'kitCooldowns' | 'tpaBlockedPlayerIds'> = {
    ranks: ['member'],
    rankId: 'member',
    balance: 0,
    xrayNotificationsEnabled: false,
    lastDeathLocation: undefined,
    lastLocation: undefined,
    deathNotificationSent: true,
    tpaRequestsDisabled: false,
    announcementsMuted: false,
    teamId: undefined,
    teamSettings: { autoTpAccept: false },
    pendingInvites: [],
    kills: 0,
    deaths: 0,
    killStreak: 0,
    totalPlayTime: 0,
    sidebarVisible: false,
    mailbox: [],
    lastDailyClaim: 0,
    dailyStreak: 0,
    starterKitClaimed: false,
    isVanished: false,
    friends: [],
    friendRequests: [],
    friendSettings: { autoTpAccept: false }
};

// --- Generic Data Handling ---

/**
 * A generic function to update a player's data. It handles getting the data,
 * running a modification callback, and saving the data.
 * Supports updating offline players by temporarily loading their data.
 * @param playerId The ID of the player to update.
 * @param modificationCallback A callback that receives the player data and modifies it.
 */
export function updatePlayerData(playerId: string, modificationCallback: (pData: PlayerData) => void) {
    let pData = activePlayerData.get(playerId);
    let wasCached = true;

    if (!isDefined(pData)) {
        wasCached = false;
        pData = loadPlayerData(playerId) ?? undefined;
    }

    if (isDefined(pData)) {
        modificationCallback(pData);
        if (wasCached) {
            pData.needsSave = true; // Mark as dirty for auto-save
        } else {
            // For offline players, save immediately and remove from cache to prevent memory leaks
            activePlayerData.set(playerId, pData);
            savePlayerData(playerId);
            activePlayerData.delete(playerId);
        }
    } else {
        errorLog(`[PlayerDataManager] Failed to update data for player ${playerId}: Not found.`);
    }
}

/**
 * Resets all in-memory caches and state variables.
 */
export function cleanupPlayerDataManager() {
    activePlayerData.clear();
    sessionStartTimes.clear();
    playerNameIdMap.clear();
    playerIdNameMap.clear();
    isNameIdMapDirty = false;
    debugLog('[PlayerDataManager] All in-memory caches have been cleared.');
}

/**
 * Helper to save a map across multiple dynamic properties (shards).
 */
function saveShardedMap(map: Map<string, string>, prefix: string) {
    const entries = [...map.entries()];
    const totalShards = Math.ceil(entries.length / MAP_SHARD_SIZE);
    const world = mc.world;

    for (let i = 0; i < totalShards; i++) {
        const start = i * MAP_SHARD_SIZE;
        const chunk = entries.slice(start, start + MAP_SHARD_SIZE);
        world.setDynamicProperty(`${prefix}${i}`, JSON.stringify(chunk));
    }

    // Cleanup stale shards if the map shrank
    let nextIndex = totalShards;
    while (world.getDynamicProperty(`${prefix}${nextIndex}`) !== undefined) {
        world.setDynamicProperty(`${prefix}${nextIndex}`, undefined);
        nextIndex++;
    }
}

/**
 * Helper to load a map from either a legacy single property or multiple shards.
 * Returns true if migration from legacy occurred.
 */
function loadShardedMap(map: Map<string, string>, _legacyKey: string, shardPrefix: string): boolean {
    const migrated = false;
    let i = 0;
    const world = mc.world;
    for (;;) {
        const data = world.getDynamicProperty(`${shardPrefix}${i}`) as string | undefined;
        if (!isNonEmptyString(data)) break;
        try {
            const entries = JSON.parse(data) as [string, string][];
            for (let j = 0; j < entries.length; j++) {
                const entry = entries[j];
                if (entry) map.set(entry[0], entry[1]);
            }
        } catch (error) {
            errorLog(`[PlayerDataManager] Failed to load shard ${shardPrefix}${i}: ${String(error)}`);
        }
        i++;
    }
    return migrated;
}

/**
 * Saves the player name-to-ID map to a dynamic property.
 */
export function saveNameIdMap() {
    try {
        saveShardedMap(playerNameIdMap, playerNameIdMapShardPrefix);
        saveShardedMap(playerIdNameMap, playerIdNameMapShardPrefix);

        isNameIdMapDirty = false;
        debugLog('[PlayerDataManager] Saved name-to-ID maps (Sharded).');
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[PlayerDataManager] Failed to save name-to-ID map: ${stack}`);
    }
}

export function loadNameIdMap() {
    try {
        loadShardedMap(playerNameIdMap, playerNameIdMapKey, playerNameIdMapShardPrefix);
        loadShardedMap(playerIdNameMap, playerIdNameMapKey, playerIdNameMapShardPrefix);

        debugLog(`[PlayerDataManager] Loaded maps. Name->ID: ${playerNameIdMap.size}, ID->Name: ${playerIdNameMap.size}`);
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[PlayerDataManager] Failed to load name-to-ID map: ${stack}`);
    }
}

/**
 * Saves a single player's data to a unique dynamic property.
 * @param playerId The ID of the player to save.
 * @returns True if successful, false otherwise.
 */
export function savePlayerData(playerId: string): boolean {
    if (!activePlayerData.has(playerId)) {
        errorLog(`[PlayerDataManager] Attempted to save data for non-cached player: ${playerId}`);
        return false;
    }
    try {
        const playerData = activePlayerData.get(playerId);
        if (isDefined(playerData)) {
            // Update Playtime before saving
            const now = Date.now();
            const sessionStart = sessionStartTimes.get(playerId);
            if (isDefined(sessionStart)) {
                const sessionDuration = now - sessionStart;
                playerData.totalPlayTime = playerData.totalPlayTime + sessionDuration;
                // Reset session start to now to avoid double counting if saved multiple times
                sessionStartTimes.set(playerId, now);
            }

            const storage = new StorageManager(`${playerPropertyPrefix}${playerId}`);
            storage.save(playerData);
            playerData.needsSave = false;
            return true;
        }
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[PlayerDataManager] Failed to save data for player ${playerId}: ${stack}`);
    }
    return false;
}

/**
 * Loads a single player's data from their unique dynamic property into the cache.
 * @param playerId The ID of the player to load.
 * @returns The loaded player data, or undefined if not found.
 */
export function loadPlayerData(playerId: string): PlayerData | undefined {
    // Safe Load: If data is already in memory, return it to avoid overwriting with stale disk data.
    if (activePlayerData.has(playerId)) {
        return activePlayerData.get(playerId)!;
    }

    try {
        const storage = new StorageManager(`${playerPropertyPrefix}${playerId}`);
        const loadedData = storage.load<Partial<PlayerData>>();

        if (isDefined(loadedData)) {
            // Merge with defaults to ensure all properties exist
            const playerData: PlayerData = {
                name: 'Unknown', // Placeholder, will be updated by getOrCreate
                homes: {},
                kitCooldowns: {},
                tpaBlockedPlayerIds: [],
                ...defaultPlayerData,
                ...loadedData
            };

            activePlayerData.set(playerId, playerData);
            return playerData;
        }
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[PlayerDataManager] Failed to load data for player ${playerId}: ${stack}`);
    }
    return undefined;
}

/**
 * Updates the name-to-ID map if the player's name has changed.
 */
function _updateNameMap(player: mc.Player) {
    const playerNameLower = player.name.toLowerCase();
    // Update if ID mismatch (name change) OR if ID not in reverse map (init)
    if (playerNameIdMap.get(playerNameLower) !== player.id || !playerIdNameMap.has(player.id)) {
        const oldName = playerIdNameMap.get(player.id);
        if (isNonEmptyString(oldName)) {
            playerNameIdMap.delete(oldName.toLowerCase());
        }
        playerNameIdMap.set(playerNameLower, player.id);
        playerIdNameMap.set(player.id, player.name);
        isNameIdMapDirty = true;
    }
}

/**
 * Creates a new player data object with default values.
 * @param player
 */
function _createNewPlayerData(player: mc.Player): PlayerData {
    const config = getConfig();
    const economyConfig = getEconomyConfig();
    const newPlayerData: PlayerData = {
        name: player.name,
        ...defaultPlayerData,
        ranks: config.playerDefaults.ranks,
        rankId: config.playerDefaults.rankId,
        balance: economyConfig.startingBalance,
        xrayNotificationsEnabled: config.playerDefaults.xrayNotificationsEnabled,
        homes: {},
        kitCooldowns: {},
        tpaBlockedPlayerIds: [],
        teamId: undefined,
        teamSettings: { autoTpAccept: false },
        pendingInvites: [],
        kills: 0,
        deaths: 0,
        killStreak: 0,
        totalPlayTime: 0,
        sidebarVisible: false,
        mailbox: [],
        lastDailyClaim: 0,
        dailyStreak: 0,
        starterKitClaimed: false,
        isVanished: false,
        friends: [],
        friendRequests: [],
        friendSettings: { autoTpAccept: false }
    };
    activePlayerData.set(player.id, newPlayerData);
    sessionStartTimes.set(player.id, Date.now());
    savePlayerData(player.id);
    return newPlayerData;
}

/**
 * Gets a player's data from the cache, or loads/creates it if it doesn't exist.
 * @param player
 */
export function getOrCreatePlayer(player: mc.Player): PlayerData {
    if (!isDefined(player)) {
        throw new Error('getOrCreatePlayer called with invalid/undefined player object');
    }
    _updateNameMap(player);

    let pData = activePlayerData.get(player.id);

    if (!isDefined(pData)) {
        pData = loadPlayerData(player.id) ?? undefined;
    }

    if (!isDefined(pData)) {
        return _createNewPlayerData(player);
    }

    // Ensure name in data matches current player name
    if (pData.name !== player.name) {
        updatePlayerData(player.id, (data) => {
            data.name = player.name;
        });
    }

    if (!sessionStartTimes.has(player.id)) {
        sessionStartTimes.set(player.id, Date.now());
    }

    return pData;
}

/**
 * Gets a player's ID from their name via the lookup map.
 * @param playerName The name of the player.
 * @returns The player's ID, or undefined if not found.
 */
export function getPlayerIdByName(playerName: string): string | undefined {
    return playerNameIdMap.get(playerName.toLowerCase());
}

/**
 * Gets a player's name from their ID via the lookup map.
 * @param playerId The ID of the player.
 * @returns The player's name, or undefined if not found.
 */
export function getPlayerNameById(playerId: string): string | undefined {
    return playerIdNameMap.get(playerId);
}

/**
 * Gets a player's data from the in-memory cache.
 * @param playerId
 */
export function getPlayer(playerId: string): PlayerData | undefined {
    return activePlayerData.get(playerId);
}

/**
 * Handles a player leaving the server by removing them from the cache.
 * @param playerId
 */
export function handlePlayerLeave(playerId: string) {
    if (activePlayerData.has(playerId)) {
        savePlayerData(playerId);
        activePlayerData.delete(playerId);
        sessionStartTimes.delete(playerId);
        debugLog(`[PlayerDataManager] Unloaded data for player ${playerId} from cache.`);
    }
}

/**
 * Gets all active (online) player data from the cache.
 */
export function getAllPlayerData(): Map<string, PlayerData> {
    return activePlayerData;
}

/**
 * Gets the map of all known player names and their corresponding IDs.
 */
export function getAllPlayerNameIdMap(): Map<string, string> {
    return playerNameIdMap;
}

/**
 * Gets a list of all known players with their correct display names.
 */
export function getAllKnownPlayers(): { id: string; name: string }[] {
    const players: { id: string; name: string }[] = [];
    if (playerIdNameMap.size > 0) {
        for (const [id, name] of playerIdNameMap.entries()) {
            players.push({ id, name });
        }
    } else {
        // Fallback to name map if ID map is empty/not loaded yet
        for (const [name, id] of playerNameIdMap.entries()) {
            players.push({ id, name }); // name is lowercase
        }
    }
    return players;
}

/**
 * Returns a list of online players visible to the observer.
 * @param observer The player viewing the list.
 */
export function getVisiblePlayers(observer: mc.Player): mc.Player[] {
    // Optimization: Use cache
    const allPlayers = getAllPlayersFromCache();

    // Staff (Level <= 2) can see everyone
    if (hasPermission(observer, 'group.mod')) {
        return allPlayers;
    }

    return allPlayers.filter((p) => {
        // Observer is regular player
        // Hide vanished players
        const targetData = getPlayer(p.id);
        return !(isDefined(targetData) && targetData.isVanished);
    });
}

/**
 * Finds a player by name, respecting vanish visibility rules.
 * @param name The name to search for.
 * @param observer The player performing the search.
 */
export function findVisiblePlayerByName(name: string, observer: mc.Player): mc.Player | undefined {
    const visible = getVisiblePlayers(observer);
    const lowerName = name.toLowerCase();
    return visible.find((p) => p.name.toLowerCase() === lowerName);
}

// --- Pending Payment Management ---

export interface PendingPayment {
    sourcePlayerId: string;
    targetPlayerId: string;
    amount: number;
    timestamp: number;
}

const pendingPayments = new Map<string, PendingPayment>();

export function createPendingPayment(sourcePlayerId: string, targetPlayerId: string, amount: number) {
    pendingPayments.set(sourcePlayerId, {
        sourcePlayerId,
        targetPlayerId,
        amount,
        timestamp: Date.now()
    });
}

export function getPendingPayment(sourcePlayerId: string): PendingPayment | undefined {
    return pendingPayments.get(sourcePlayerId);
}

export function clearPendingPayment(sourcePlayerId: string) {
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
            if (isDefined(player)) {
                player.sendMessage('§cYour pending payment has expired.');
            }
        }
    }
}

// --- Dimension Lock State Management ---

const netherLockKey = 'exe:dimensionLock_nether';
const endLockKey = 'exe:dimensionLock_end';

export function getLockState(dimension: string): boolean {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        return (mc.world.getDynamicProperty(key) as boolean | undefined) === true;
    } catch {
        return false;
    }
}

export function setLockState(dimension: string, isLocked: boolean) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        mc.world.setDynamicProperty(key, isLocked);
    } catch {
        errorLog(`[DimensionLock] Failed to set lock state for ${dimension}.`);
    }
}

// --- Data Modification Wrappers ---

export function setPlayerRank(playerId: string, rankId: string) {
    updatePlayerData(playerId, (pData) => {
        pData.rankId = rankId;
    });
}

export function setPlayerRanks(playerId: string, ranks: string[]) {
    updatePlayerData(playerId, (pData) => {
        pData.ranks = ranks;
    });
}

export function setPlayerAnnouncementsMuted(playerId: string, isMuted: boolean) {
    updatePlayerData(playerId, (pData) => {
        pData.announcementsMuted = isMuted;
    });
}

export function setTpaRequestsDisabled(playerId: string, isDisabled: boolean) {
    updatePlayerData(playerId, (pData) => {
        pData.tpaRequestsDisabled = isDisabled;
    });
}

export function addTpaBlockedPlayer(playerId: string, blockedPlayerId: string) {
    updatePlayerData(playerId, (pData) => {
        if (!pData.tpaBlockedPlayerIds.includes(blockedPlayerId)) {
            pData.tpaBlockedPlayerIds.push(blockedPlayerId);
        }
    });
}

export function removeTpaBlockedPlayer(playerId: string, unblockedPlayerId: string) {
    updatePlayerData(playerId, (pData) => {
        pData.tpaBlockedPlayerIds = pData.tpaBlockedPlayerIds.filter((id) => id !== unblockedPlayerId);
    });
}

export function setPlayerHome(playerId: string, homeName: string, location: HomeLocation) {
    updatePlayerData(playerId, (pData) => {
        pData.homes[homeName] = location;
    });
}

export function deletePlayerHome(playerId: string, homeName: string) {
    updatePlayerData(playerId, (pData) => {
        delete pData.homes[homeName];
    });
}

export function setPlayerBalance(playerId: string, newBalance: number) {
    const economyConfig = getEconomyConfig();
    const min = economyConfig.minBalance;
    const max = economyConfig.maxBalance;

    updatePlayerData(playerId, (pData) => {
        const clampedBalance = Math.max(min, Math.min(newBalance, max));
        // Strict 2-decimal precision
        pData.balance = Number.parseFloat(clampedBalance.toFixed(2));
        updateAndSaveLeaderboard(playerId, pData.name, pData.balance);
    });
}

export function incrementPlayerBalance(playerId: string, amount: number) {
    const economyConfig = getEconomyConfig();
    const min = economyConfig.minBalance;
    const max = economyConfig.maxBalance;

    updatePlayerData(playerId, (pData) => {
        // Ensure current balance is treated as a number to prevent string concatenation or NaN issues
        const currentBal = Number(pData.balance);
        const safeBal = Number.isNaN(currentBal) ? 0 : currentBal;
        const potentialBalance = safeBal + amount;
        const clampedBalance = Math.max(min, Math.min(potentialBalance, max));
        // Strict 2-decimal precision
        pData.balance = Number.parseFloat(clampedBalance.toFixed(2));
        // Log transaction regardless of debug level
        infoLog(`[Economy] Updating balance for ${pData.name}. Old: ${safeBal}, Change: ${amount}, New: ${pData.balance}`);
        updateAndSaveLeaderboard(playerId, pData.name, pData.balance);
    });
}

export function setKitCooldown(playerId: string, kitName: string, timestamp: number) {
    updatePlayerData(playerId, (pData) => {
        pData.kitCooldowns[kitName] = timestamp;
    });
}

export function setPlayerXrayNotifications(playerId: string, status: boolean) {
    updatePlayerData(playerId, (pData) => {
        pData.xrayNotificationsEnabled = status;
    });
}

export function setPlayerLastDeathLocation(playerId: string, location: HomeLocation | undefined) {
    updatePlayerData(playerId, (pData) => {
        pData.lastDeathLocation = location;
        if (isDefined(location)) {
            pData.deathNotificationSent = false;
        }
    });
}

export function setPlayerLastLocation(playerId: string, location: HomeLocation | undefined) {
    updatePlayerData(playerId, (pData) => {
        pData.lastLocation = location;
    });
}

export function setDeathNotificationSent(playerId: string, status: boolean) {
    updatePlayerData(playerId, (pData) => {
        pData.deathNotificationSent = status;
    });
}

// --- Economy Specific Logic ---

export function getBalance(playerId: string): number | undefined {
    const pData = getPlayer(playerId);
    return (isDefined(pData) ? pData.balance : undefined) ?? undefined;
}

export function transfer(sourcePlayerId: string, targetPlayerId: string, amount: number): { success: boolean; message: string } {
    if (amount <= 0) {
        return { success: false, message: 'Transfer amount must be positive.' };
    }

    // 1. Get Source Data
    const sourceData = getPlayer(sourcePlayerId);
    if (!isDefined(sourceData)) {
        return { success: false, message: 'Could not find your player data.' };
    }

    const currentSourceBal = Number(sourceData.balance);
    if (currentSourceBal < amount) {
        return { success: false, message: 'You do not have enough money for this transaction.' };
    }

    // 2. Get Target Data (Load if offline)
    // Check if target is already cached to decide if we should unload later
    const targetIsCached = activePlayerData.has(targetPlayerId);
    let targetData = activePlayerData.get(targetPlayerId);

    if (!isDefined(targetData)) {
        targetData = loadPlayerData(targetPlayerId);
    }

    if (!isDefined(targetData)) {
        return { success: false, message: "Could not find the target player's data." };
    }

    const economyConfig = getEconomyConfig();
    const max = economyConfig.maxBalance;
    const currentTargetBal = Number(targetData.balance);
    const safeTargetBal = Number.isNaN(currentTargetBal) ? 0 : currentTargetBal;

    if (safeTargetBal + amount > max) {
        if (!targetIsCached) {
            activePlayerData.delete(targetPlayerId);
        }
        return {
            success: false,
            message: `Transfer failed. The target player cannot hold more than ${formatCurrency(max)}.`
        };
    }

    // 3. Execute Transaction (Atomic In-Memory)
    try {
        const newSourceBal = Number.parseFloat((currentSourceBal - amount).toFixed(2));
        const newTargetBal = Number.parseFloat((safeTargetBal + amount).toFixed(2));

        // Apply Source
        sourceData.balance = newSourceBal;
        updateAndSaveLeaderboard(sourcePlayerId, sourceData.name, sourceData.balance);
        sourceData.needsSave = true;

        // Force Save Source (Transaction Safety)
        savePlayerData(sourcePlayerId);

        // Apply Target
        targetData.balance = newTargetBal;
        updateAndSaveLeaderboard(targetPlayerId, targetData.name, targetData.balance);

        if (targetIsCached) {
            targetData.needsSave = true;
            // Force save target for consistency
            savePlayerData(targetPlayerId);
        } else {
            // Because target is offline, they are not cached.
            // In savePlayerData, it checks if `activePlayerData.has(playerId)`.
            // So we need to put it in the cache briefly to save it.
            activePlayerData.set(targetPlayerId, targetData);
            savePlayerData(targetPlayerId);
            activePlayerData.delete(targetPlayerId);
            debugLog(`[Economy] Unloaded offline target ${targetPlayerId} after transfer.`);
        }

        infoLog(`[Economy] Transfer: ${sourceData.name} -> ${targetData.name} ($${amount}). New Bals: ${newSourceBal} / ${newTargetBal}`);

        return { success: true, message: 'Transfer successful.' };
    } catch (error) {
        errorLog(`[Economy] Transfer transaction error: ${String(error)}`);
        return { success: false, message: 'An internal error occurred during transfer.' };
    }
}

// --- Stats Management ---

export function incrementKillCount(playerId: string) {
    updatePlayerData(playerId, (pData) => {
        pData.kills = (pData.kills || 0) + 1;
    });
}

export function incrementDeathCount(playerId: string) {
    updatePlayerData(playerId, (pData) => {
        pData.deaths = (pData.deaths || 0) + 1;
    });
}

export function incrementKillStreak(playerId: string) {
    updatePlayerData(playerId, (pData) => {
        pData.killStreak = (pData.killStreak || 0) + 1;
    });
}

export function resetKillStreak(playerId: string) {
    updatePlayerData(playerId, (pData) => {
        pData.killStreak = 0;
    });
}

/**
 * Gets the total playtime in milliseconds (historical + current session).
 */
export function getPlayTime(playerId: string): number {
    const pData = getPlayer(playerId);
    if (!isDefined(pData)) return 0;

    let currentSessionTime = 0;
    const start = sessionStartTimes.get(playerId);
    if (isDefined(start)) {
        currentSessionTime = Date.now() - start;
    }

    return pData.totalPlayTime + currentSessionTime;
}

export function setSidebarVisible(playerId: string, visible: boolean) {
    updatePlayerData(playerId, (pData) => {
        pData.sidebarVisible = visible;
    });
}

export function getSidebarVisible(playerId: string): boolean {
    const pData = getPlayer(playerId);
    return (isDefined(pData) ? pData.sidebarVisible : undefined) ?? false;
}
