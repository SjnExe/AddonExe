import * as mc from '@minecraft/server';
import { loadConfig, getConfig } from './configManager.js';
import { getSpawnConfig, loadEconomyConfig, loadKitsConfig, loadRanksConfig, loadShopConfig, loadSpawnConfig, loadXrayConfig } from './configurations.js';
import * as dataManager from './dataManager.js';
import * as rankManager from './rankManager.js';
import {
    getOrCreatePlayer,
    setPlayerRank,
    cleanupPlayerDataManager,
    clearExpiredPayments,
    loadNameIdMap,
    initializeLeaderboard
} from './playerDataManager.js';
import { loadPunishments, clearExpiredPunishments, initializePunishmentManager } from './punishmentManager.js';
import { loadReports, clearOldResolvedReports } from './reportManager.js';
import { loadCooldowns, clearExpiredCooldowns } from './cooldownManager.js';
import * as bountyManager from './bountyManager.js';
import * as teamManager from './teamManager.js';
import { errorLog, setLogLevel, infoLog } from './logger.js';
import { initializeEventManager, cleanupEventManager } from './events/eventManager.js';
import { cleanupTimers, setTrackedInterval } from './timerManager.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';
import { initializeXrayDetection } from '../modules/detections/xrayDetection.js';
import { restartAnnouncer } from '../modules/commands/announcement.js';
import { floatingTextManager } from './floatingTextManager.js';
import '../modules/commands/index.js';
import './mobDeathEvents.js';

/**
 * Checks a player's rank and updates it if necessary.
 * @param {import('@minecraft/server').Player} player The player to check.
 */
export function updatePlayerRank(player) {
    const pData = getOrCreatePlayer(player);
    if (!pData) { return; }

    const config = getConfig();
    if (!config) {return;} // Guard against config not being loaded
    const oldRankId = pData.rankId;
    const newRank = rankManager.getPlayerRank(player, config);

    if (oldRankId !== newRank.id) {
        setPlayerRank(player.id, newRank.id, newRank.permissionLevel);
        infoLog(`[AddonExe] Player ${player.name}'s rank updated from ${oldRankId} to ${newRank.name}.`);
        player.sendMessage(`§aYour rank has been updated to ${newRank.name}.`);
    }
    rankManager.updatePlayerNameTag(player, config);
}

/**
 * Iterates through all online players and updates their ranks.
 */
export function updateAllPlayerRanks() {
    for (const player of mc.world.getAllPlayers()) {
        updatePlayerRank(player);
    }
}

/**
 * Re-initializes the state for all players currently online.
 * This is crucial for restoring player data after a script reload.
 */
function reinitializeOnlinePlayers() {
    infoLog(`[AddonExe] Re-initializing state for ${mc.world.getAllPlayers().length} online players...`);
    for (const player of mc.world.getAllPlayers()) {
        // Ensure the player's data is loaded into the system
        getOrCreatePlayer(player);
        // Then, update their rank based on the loaded data and config
        updatePlayerRank(player);
    }
    infoLog('[AddonExe] Player re-initialization complete.');
}

/**
 * Loads all persistent data from dynamic properties.
 */
function loadPersistentData() {
    infoLog('[AddonExe] Loading persistent data...');
    loadNameIdMap();
    loadPunishments();
    loadReports();
    loadCooldowns();
    bountyManager.loadBounties();
    initializeLeaderboard();
}

/**
 * Initializes all core managers and performs startup data clearing.
 */
function initializeManagers() {
    infoLog('[AddonExe] Initializing managers...');
    rankManager.initialize();
    initializePunishmentManager();
    floatingTextManager.initialize();
    teamManager.initialize();
    // Clear any expired data on startup
    clearExpiredPunishments();
    clearOldResolvedReports();
    clearExpiredCooldowns();
    clearExpiredPayments();
}

/**
 * Checks for critical configuration issues.
 */
function checkConfiguration() {
    const config = getConfig();
    const spawnConfig = getSpawnConfig();

    // Correctly check for a configured owner.
    // The check is now more robust:
    // 1. It ensures ownerPlayerNames is an array.
    // 2. It verifies the array is not empty.
    // 3. It checks that the array doesn't solely contain the default placeholder.
    const ownerNames = config?.ownerPlayerNames;
    const isOwnerConfigured = Array.isArray(ownerNames) && ownerNames.length > 0 && (ownerNames.length > 1 || ownerNames[0] !== 'Your•Name•Here');

    if (!isOwnerConfigured) {
        const warningMessage = '§l§c[AddonExe] WARNING: No owner is configured. Please set `ownerPlayerNames` in `scripts/config.js` to gain access to admin commands.';
        mc.system.runTimeout(() => mc.world.sendMessage(warningMessage), 20);
        errorLog('[AddonExe] No owner configured.');
    }

    if (!spawnConfig.spawn || !spawnConfig.spawn.spawnLocation) {
        const spawnWarning = '§l§e[AddonExe] NOTICE: The server spawn has not been set. Spawn protection and the /spawn command will not function until an admin runs /setspawn.';
        mc.system.runTimeout(() => mc.world.sendMessage(spawnWarning), 40);
        errorLog('[AddonExe] Server spawn not set.');
    }
}

/**
 * Starts all recurring system timers.
 */
function startSystemTimers() {
    // Periodically clear expired payment confirmations (every 60 seconds)
    setTrackedInterval(clearExpiredPayments, 60 * 20);
    // Rank updates are now handled by events (e.g., !admin command)
    infoLog('[AddonExe] System timers started.');
}

/**
 * Main entry point for addon initialization.
 */
async function initializeAddon() {
    infoLog('[AddonExe] Initializing addon...');

    // Dynamically import the main config file to get the version number.
    // This is necessary because we need to know if it's a migration before loading all configs.
    const { config: tempConfig } = await import('../config.js');
    const newVersion = String(tempConfig.version);
    const lastVersion = mc.world.getDynamicProperty('exe:lastVersion');
    const isMigration = !lastVersion || lastVersion !== newVersion;

    // Load all configurations synchronously with the correct migration flag.
    loadConfig(isMigration);
    loadKitsConfig(isMigration);
    loadShopConfig(isMigration);
    loadRanksConfig(isMigration);
    loadSpawnConfig(isMigration);
    loadEconomyConfig(isMigration);
    loadXrayConfig(isMigration);

    // Set the log level from the newly loaded config
    const config = getConfig();
    setLogLevel(config.logLevel);

    mc.world.setDynamicProperty('exe:lastVersion', newVersion);

    dataManager.initializeDataManager();
    loadPersistentData();
    initializeManagers();
    checkConfiguration();
    initializeEventManager();
    initializeSpawnProtection();
    initializeXrayDetection();
    restartAnnouncer(); // Start the announcement system

    // Restore state for any players who were online during the reload
    reinitializeOnlinePlayers();

    startSystemTimers();
    infoLog('[AddonExe] Addon initialized successfully.');
}

/**
 * Cleans up all registered events and timers.
 * This is essential for a clean script reload.
 */
function cleanupAddon() {
    // Using console.log for raw output that is not affected by logger settings.
    // This is crucial for debugging script unload.
    // eslint-disable-next-line no-console
    console.log('[AddonExe] SCRIPT_UNLOAD detected. Cleaning up timers and events...');
    floatingTextManager.cleanup();
    cleanupPlayerDataManager();
    cleanupEventManager();
    cleanupTimers();
    // eslint-disable-next-line no-console
    console.log('[AddonExe] Cleanup complete. The script will now unload.');
}

// Defer the entire addon initialization by one tick.
// This is a crucial step to prevent a race condition where the script tries to access APIs
// from @minecraft/server before they are fully initialized by the game engine.
mc.system.runTimeout(async () => {
    try {
        await initializeAddon();
    } catch (e) {
        errorLog('[AddonExe] A critical error occurred during addon initialization:');
        errorLog(e.stack);
        mc.world.sendMessage('§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.');
    }
}, 0);

mc.system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id } = event;

    // Handle script unload event
    if (id === 'minecraft:script_unload') {
        cleanupAddon();
        return;
    }
    // Other script events are handled by handleScriptEventReceive in core/events/scriptEventReceive.js
});