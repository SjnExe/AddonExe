import { world, system } from '@minecraft/server';
import { loadConfig, getConfig, updateConfig } from './configManager.js';
import { getSpawnConfig, loadKitsConfig, loadRanksConfig, loadShopConfig, loadSpawnConfig } from './configurations.js';
import * as dataManager from './dataManager.js';
import * as rankManager from './rankManager.js';
import * as playerDataManager from './playerDataManager.js';
import { loadPunishments, clearExpiredPunishments, initializePunishmentManager } from './punishmentManager.js';
import { loadReports, clearOldResolvedReports } from './reportManager.js';
import { loadCooldowns, clearExpiredCooldowns } from './cooldownManager.js';
import * as economyManager from './economyManager.js';
import * as bountyManager from './bountyManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
import { startRestart } from './restartManager.js';
import { initializeEventManager, cleanupEventManager } from './events/eventManager.js';
import { cleanupTimers, setTrackedInterval } from './timerManager.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';
import '../modules/commands/index.js';

/**
 * Checks a player's rank and updates it if necessary.
 * @param {import('@minecraft/server').Player} player The player to check.
 */
export function updatePlayerRank(player) {
    const pData = playerDataManager.getPlayer(player.id);
    if (!pData) { return; }

    const config = getConfig();
    if (!config) {return;} // Guard against config not being loaded
    const oldRankId = pData.rankId;
    const newRank = rankManager.getPlayerRank(player, config);

    if (oldRankId !== newRank.id) {
        playerDataManager.setPlayerRank(player.id, newRank.id, newRank.permissionLevel);
        debugLog(`[AddonExe] Player ${player.name}'s rank updated from ${oldRankId} to ${newRank.name}.`);
        player.sendMessage(`§aYour rank has been updated to ${newRank.name}.`);
    }
}

/**
 * Iterates through all online players and updates their ranks.
 */
export function updateAllPlayerRanks() {
    for (const player of world.getAllPlayers()) {
        updatePlayerRank(player);
    }
}

/**
 * Loads all persistent data from dynamic properties.
 */
function loadPersistentData() {
    debugLog('[AddonExe] Loading persistent data...');
    playerDataManager.loadNameIdMap();
    loadPunishments();
    loadReports();
    loadCooldowns();
    bountyManager.loadBounties();
    playerDataManager.initializeLeaderboard();
}

/**
 * Initializes all core managers and performs startup data clearing.
 */
function initializeManagers() {
    debugLog('[AddonExe] Initializing managers...');
    rankManager.initialize();
    initializePunishmentManager();
    // Clear any expired data on startup
    clearExpiredPunishments();
    clearOldResolvedReports();
    clearExpiredCooldowns();
    economyManager.clearExpiredPayments();
}

/**
 * Checks for critical configuration issues.
 */
function checkConfiguration() {
    const config = getConfig();
    const spawnConfig = getSpawnConfig();
    // Add a guard in case config hasn't loaded yet, though the init flow should prevent this.
    if (!config || !config.ownerPlayerNames || !config.ownerPlayerNames.length || config.ownerPlayerNames[0] === 'Your•Name•Here') {
        const warningMessage = '§l§c[AddonExe] WARNING: No owner is configured. Please set `ownerPlayerNames` in `scripts/config.js` to gain access to admin commands.';
        system.runTimeout(() => world.sendMessage(warningMessage), 20);
        errorLog('[AddonExe] No owner configured.');
    }

    if (!spawnConfig.spawn || !spawnConfig.spawn.spawnLocation) {
        const spawnWarning = '§l§e[AddonExe] NOTICE: The server spawn has not been set. Spawn protection and the /spawn command will not function until an admin runs /setspawn.';
        system.runTimeout(() => world.sendMessage(spawnWarning), 40);
        errorLog('[AddonExe] Server spawn not set.');
    }
}

/**
 * Starts all recurring system timers.
 */
function startSystemTimers() {
    // Periodically clear expired payment confirmations
    setTrackedInterval(economyManager.clearExpiredPayments, 6000); // 5 minutes
    // Rank updates are now handled by events (e.g., !admin command)
    debugLog('[AddonExe] System timers started.');
}

/**
 * Main entry point for addon initialization.
 */
async function initializeAddon() {
    debugLog('[AddonExe] Initializing addon...');

    // Dynamically import the main config file to get the version number.
    // This is necessary because we need to know if it's a migration before loading all configs.
    const { config: tempConfig } = await import('../config.js');
    const newVersion = String(tempConfig.version);
    const lastVersion = world.getDynamicProperty('exe:lastVersion');
    const isMigration = !lastVersion || lastVersion !== newVersion;

    // Load all configurations with the correct migration flag.
    const loadPromises = [
        loadConfig(isMigration),
        loadKitsConfig(isMigration),
        loadShopConfig(isMigration),
        loadRanksConfig(isMigration),
        loadSpawnConfig(isMigration)
    ];
    await Promise.all(loadPromises);

    world.setDynamicProperty('exe:lastVersion', newVersion);

    dataManager.initializeDataManager();
    loadPersistentData();
    initializeManagers();
    checkConfiguration();
    initializeEventManager();
    initializeSpawnProtection();

    startSystemTimers();
    debugLog('[AddonExe] Addon initialized successfully.');
}

/**
 * Cleans up all registered events and timers.
 * This is essential for a clean script reload.
 */
function cleanupAddon() {
    debugLog('[AddonExe] Cleaning up addon for reload...');
    cleanupEventManager();
    cleanupTimers();
    debugLog('[AddonExe] Cleanup complete.');
}

// Run the initialization logic on the next tick after the script is loaded.
system.run(async () => {
    try {
        // Run cleanup first to handle reloads gracefully
        cleanupAddon();
        await initializeAddon();
    } catch (e) {
        errorLog('[AddonExe] A critical error occurred during addon initialization:');
        errorLog(e.stack);
        world.sendMessage('§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.');
    }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id, sourceEntity, message } = event;

    // Handle script unload event
    if (id === 'minecraft:script_unload') {
        cleanupAddon();
        return;
    }

    const config = getConfig(); // Config should be loaded by the time this event fires for custom events.
    if (!config) { return; }


    switch (id) {
        case 'exe:restart':
            startRestart(sourceEntity);
            break;

        case 'exe:toggle_chat_log': {
            const chatConfig = config.chat || { logToConsole: false };
            const newValue = !chatConfig.logToConsole;
            chatConfig.logToConsole = newValue;
            updateConfig('chat', chatConfig);

            const feedbackMessage = `§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`;
            if (sourceEntity && sourceEntity.sendMessage) {
                sourceEntity.sendMessage(feedbackMessage);
            }
            // eslint-disable-next-line no-console
            console.log(`[AddonExe] ${feedbackMessage}`);
            break;
        }

        case 'exe:grant_admin_self': {
            if (sourceEntity && sourceEntity.addTag) {
                sourceEntity.addTag(config.adminTag);
                sourceEntity.sendMessage('§aYou have been promoted to Admin.');
                updateAllPlayerRanks();
            }
            break;
        }
    }
});