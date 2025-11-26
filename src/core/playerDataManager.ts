import * as mc from '@minecraft/server';

import { getConfig } from './configManager.js';
import { getEconomyConfig } from './configurations.js';
import { debugLog, errorLog } from './logger.js';
import { getPlayerFromCache } from './playerCache.js';

const playerPropertyPrefix = 'exe:player.';
const playerNameIdMapKey = 'exe:playerNameIdMap';
const leaderboardKey = 'exe:economyLeaderboard';

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

export interface PlayerData {
    name: string;
    rankId: string;
    permissionLevel: number;
    homes: Record<string, HomeLocation>;
    balance: number;
    kitCooldowns: Record<string, number>;
    xrayNotificationsEnabled: boolean;
    lastDeathLocation: HomeLocation | null;
    deathNotificationSent: boolean;
    tpaRequestsDisabled: boolean;
    tpaBlockedPlayerIds: string[];
    announcementsMuted: boolean;
    teamId: number | null;
    teamSettings: { autoTpAccept: boolean };
    pendingInvites: PendingInvite[];
    needsSave?: boolean;
}

export interface LeaderboardEntry {
    playerId: string;
    name: string;
    balance: number;
}

let leaderboardCache: LeaderboardEntry[] = [];
let isLeaderboardDirty = false;
let isSaveOnCooldown = false;

const activePlayerData = new Map<string, PlayerData>();

let playerNameIdMap = new Map<string, string>();

const playerIdNameMap = new Map<string, string>();

/** A flag indicating that the name-to-ID map has changed and needs to be saved. */
export let isNameIdMapDirty = false;

/**
 * Defines the default structure and values for a new player.
 */
const defaultPlayerData: Omit<PlayerData, 'name' | 'homes' | 'kitCooldowns' | 'tpaBlockedPlayerIds'> = {
    rankId: 'member',
    permissionLevel: 1024,
    balance: 0,
    xrayNotificationsEnabled: false,
    lastDeathLocation: null,
    deathNotificationSent: true,
    tpaRequestsDisabled: false,
    announcementsMuted: false,
    teamId: null,
    teamSettings: { autoTpAccept: false },
    pendingInvites: []
};

// --- Generic Data Handling ---

/**
 * A generic function to update a player's data. It handles getting the data,
 * running a modification callback, and saving the data.
 * @param playerId The ID of the player to update.
 * @param modificationCallback A callback that receives the player data and modifies it.
 */
export function updatePlayerData(playerId: string, modificationCallback: (pData: PlayerData) => void) {
    const pData = getPlayer(playerId);
    if (pData) {
        modificationCallback(pData);
        pData.needsSave = true; // Mark as dirty
        // savePlayerData(playerId); // Removed immediate save for batching, or should we keep it?
        // Original code called savePlayerData(playerId).
        // If we use batching via dataManager, we might rely on needsSave.
        // However, saving immediately is safer for crash protection unless performance is issue.
        // The original code did:
        // modificationCallback(pData);
        // savePlayerData(playerId);
        // I'll stick to original logic + set needsSave for redundancy/batch checks?
        // Actually, savePlayerData writes to dynamic property immediately.
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
        mc.world.setDynamicProperty(playerNameIdMapKey, JSON.stringify(dataToSave));
        isNameIdMapDirty = false;
        debugLog('[PlayerDataManager] Saved name-to-ID map.');
    } catch (e: any) {
        errorLog(`[PlayerDataManager] Failed to save name-to-ID map: ${e.stack}`);
    }
}

export function loadNameIdMap() {
    try {
        const dataString = mc.world.getDynamicProperty(playerNameIdMapKey) as string | undefined;
        if (dataString && typeof dataString === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsedData: any = JSON.parse(dataString);
            playerNameIdMap = new Map(parsedData);
            debugLog(`[PlayerDataManager] Loaded ${playerNameIdMap.size} entries into name-to-ID map.`);
        }
    } catch (e: any) {
        errorLog(`[PlayerDataManager] Failed to load name-to-ID map: ${e.stack}`);
    }
}

/**
 * Saves a single player's data to a unique dynamic property.
 * @param playerId The ID of the player to save.
 */
export function savePlayerData(playerId: string) {
    if (!activePlayerData.has(playerId)) {
        errorLog(`[PlayerDataManager] Attempted to save data for non-cached player: ${playerId}`);
        return;
    }
    try {
        const playerData = activePlayerData.get(playerId);
        if (playerData) {
            // Clean needsSave before saving to disk if we don't want to persist it (it's runtime flag).
            // But serialization includes it. It's harmless.
            const dataString = JSON.stringify(playerData);
            mc.world.setDynamicProperty(`${playerPropertyPrefix}${playerId}`, dataString);
            playerData.needsSave = false;
        }
    } catch (e: any) {
        errorLog(`[PlayerDataManager] Failed to save data for player ${playerId}: ${e.stack}`);
    }
}

/**
 * Loads a single player's data from their unique dynamic property into the cache.
 * @param playerId The ID of the player to load.
 * @returns The loaded player data, or null if not found.
 */
export function loadPlayerData(playerId: string): PlayerData | null {
    try {
        const dataString = mc.world.getDynamicProperty(`${playerPropertyPrefix}${playerId}`) as string | undefined;
        if (dataString && typeof dataString === 'string') {
            const loadedData = JSON.parse(dataString);

            // Merge with defaults to ensure all properties exist
            const playerData: PlayerData = {
                ...defaultPlayerData,
                name: 'Unknown', // Placeholder, will be updated by getOrCreate
                homes: {},
                kitCooldowns: {},
                tpaBlockedPlayerIds: [],
                ...loadedData
            };

            activePlayerData.set(playerId, playerData);
            return playerData;
        }
    } catch (e: any) {
        errorLog(`[PlayerDataManager] Failed to load data for player ${playerId}: ${e.stack}`);
    }
    return null;
}

/**
 * Updates the name-to-ID map if the player's name has changed.
 */
function _updateNameMap(player: mc.Player) {
    const playerNameLower = player.name.toLowerCase();
    if (playerNameIdMap.get(playerNameLower) !== player.id) {
        const oldName = playerIdNameMap.get(player.id);
        if (oldName) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = getConfig();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const economyConfig: any = getEconomyConfig();
    const newPlayerData: PlayerData = {
        name: player.name,
        ...defaultPlayerData,
        rankId: config.playerDefaults.rankId,
        permissionLevel: config.playerDefaults.permissionLevel,
        balance: economyConfig.startingBalance,
        xrayNotificationsEnabled: config.playerDefaults.xrayNotificationsEnabled,
        homes: {},
        kitCooldowns: {},
        tpaBlockedPlayerIds: [],
        teamId: null,
        teamSettings: { autoTpAccept: false },
        pendingInvites: []
    };
    activePlayerData.set(player.id, newPlayerData);
    savePlayerData(player.id);
    return newPlayerData;
}

/**
 * Gets a player's data from the cache, or loads/creates it if it doesn't exist.
 * @param player
 */
export function getOrCreatePlayer(player: mc.Player): PlayerData {
    _updateNameMap(player);

    let pData = activePlayerData.get(player.id);

    if (!pData) {
        pData = loadPlayerData(player.id) || undefined;
    }

    if (!pData) {
        return _createNewPlayerData(player);
    }

    // Ensure name in data matches current player name
    if (pData.name !== player.name) {
        updatePlayerData(player.id, (data) => {
            data.name = player.name;
        });
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
        activePlayerData.delete(playerId);
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

// --- Leaderboard Management ---

export function getLeaderboard(): LeaderboardEntry[] {
    return leaderboardCache;
}

export function initializeLeaderboard() {
    try {
        const dataString = mc.world.getDynamicProperty(leaderboardKey) as string | undefined;
        if (dataString && typeof dataString === 'string') {
            leaderboardCache = JSON.parse(dataString);
            debugLog(`[PlayerDataManager] Loaded ${leaderboardCache.length} players into leaderboard cache.`);
            return;
        }
    } catch (e: any) {
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
        mc.world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        isLeaderboardDirty = false;
        isSaveOnCooldown = true;
        mc.system.runTimeout(() => {
            isSaveOnCooldown = false;
            if (isLeaderboardDirty) {
                triggerLeaderboardSave();
            }
        }, 30 * 20);
    } catch (e: any) {
        errorLog(`[PlayerDataManager] Failed to save leaderboard: ${e.stack}`);
    }
}

function updateAndSaveLeaderboard(playerId: string, pData: PlayerData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    const lowestBalanceOnBoard =
        leaderboardCache.length < cacheSize ? 0 : (leaderboardCache[leaderboardCache.length - 1]?.balance ?? 0);
    const existingIndex = leaderboardCache.findIndex((p) => p.playerId === playerId);
    const playerIsOnBoard = existingIndex !== -1;

    // Optimization: Skip if player is not on board AND their balance is too low to enter
    if (!playerIsOnBoard && pData.balance <= lowestBalanceOnBoard) {
        return;
    }

    // Optimization: If player is on board, check if their balance actually changed enough to matter?
    // Actually, if they are on the board, we always need to update their entry.
    // But we can check if the balance value is identical to what we have in cache.
    if (playerIsOnBoard) {
        if (leaderboardCache[existingIndex].balance === pData.balance) {
            return;
        } // No change in value
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = getConfig();
    const timeout = config.economy.paymentConfirmationTimeout * 1000; // convert to ms
    const now = Date.now();

    for (const [playerId, payment] of pendingPayments.entries()) {
        if (now - payment.timestamp > timeout) {
            pendingPayments.delete(playerId);
            const player = getPlayerFromCache(playerId);
            if (player) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (player as any).sendMessage('§cYour pending payment has expired.');
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
        return !!mc.world.getDynamicProperty(key);
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

export function setPlayerRank(playerId: string, rankId: string, permissionLevel: number) {
    updatePlayerData(playerId, (pData) => {
        pData.rankId = rankId;
        pData.permissionLevel = permissionLevel;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const economyConfig: any = getEconomyConfig();
    const min = economyConfig.minBalance ?? -1000000;
    const max = economyConfig.maxBalance ?? 1000000000;

    updatePlayerData(playerId, (pData) => {
        pData.balance = Math.max(min, Math.min(newBalance, max));
        updateAndSaveLeaderboard(playerId, pData);
    });
}

export function incrementPlayerBalance(playerId: string, amount: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const economyConfig: any = getEconomyConfig();
    const min = economyConfig.minBalance ?? -1000000;
    const max = economyConfig.maxBalance ?? 1000000000;

    updatePlayerData(playerId, (pData) => {
        const potentialBalance = pData.balance + amount;
        pData.balance = Math.max(min, Math.min(potentialBalance, max));
        updateAndSaveLeaderboard(playerId, pData);
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

export function setPlayerLastDeathLocation(playerId: string, location: HomeLocation | null) {
    updatePlayerData(playerId, (pData) => {
        pData.lastDeathLocation = location;
        if (location) {
            pData.deathNotificationSent = false;
        }
    });
}

export function setDeathNotificationSent(playerId: string, status: boolean) {
    updatePlayerData(playerId, (pData) => {
        pData.deathNotificationSent = status;
    });
}

// --- Economy Specific Logic ---

export function getBalance(playerId: string): number | null {
    const pData = getPlayer(playerId);
    return pData?.balance ?? null;
}

export function transfer(
    sourcePlayerId: string,
    targetPlayerId: string,
    amount: number
): { success: boolean; message: string } {
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
        return { success: false, message: "Could not find the target player's data." };
    }

    incrementPlayerBalance(sourcePlayerId, -amount);
    incrementPlayerBalance(targetPlayerId, amount);

    return { success: true, message: 'Transfer successful.' };
}
