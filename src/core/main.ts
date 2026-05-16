import * as mc from '@minecraft/server';

import { loadCommands } from '@core/commands/index.js';
import { initializeXrayDetection } from '@features/anticheat/xrayDetection.js';
import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { cleanupSpawnProtection, initializeSpawnProtection } from '@features/essentials/spawnProtection.js';
import { isNonEmptyString } from '@lib/guards.js';
import { getConfig, initializeConfigManager } from '@core/configManager.js';
import {
    loadAuctionHouseConfig,
    loadDailyRewardsConfig,
    loadEconomyConfig,
    loadKitsConfig,
    loadRanksConfig,
    loadShopConfig,
    loadSidebarConfig,
    loadSpawnConfig,
    loadTeamConfig,
    loadWorldProtectionConfig,
    loadXrayConfig
} from '@core/configurations.js';
import { dataManager, loadPersistentData } from '@core/dataManager.js';
import { cleanupEventManager, initializeEventManager } from '@core/events/eventManager.js';
import { initializeFeatureDependencies } from '@core/featureDependencies.js';
import { cleanup as cleanupFloatingText } from '@core/floatingTextManager.js';
import { cleanupLeaderboardManager } from '@core/leaderboardManager.js';
import { errorLog, infoLog, setLogLevel } from '@core/logger.js';
import { initializeMigration } from '@core/migrationManager.js';
import { cleanupPlayerDataManager } from '@core/playerDataManager.js';
import * as rankManager from '@core/rankManager.js';
import * as sidebarManager from '@core/sidebarManager.js';
import { cleanupTimers, startSystemTimers } from '@core/timerManager.js';
import { initialize as initializeUIPanels } from '@ui/panels/index.js';
import { reinitializeOnlinePlayers } from '@core/utils.js';

const VERSION = '0.7.0'; // Current Addon Version

// Load Commands immediately to register slash commands during startup
loadCommands();

/**
 * Initializes the addon.
 * This function should be called once at startup.
 */
export async function initializeAddon() {
    infoLog('[AddonExe] Initializing...');

    // Version Check & Migration Flag
    const newVersionStr = VERSION;
    const lastVersionStr = mc.world.getDynamicProperty('exe:lastVersion') as string | undefined;

    let isMigration = true;
    if (isNonEmptyString(lastVersionStr)) {
        // Trigger migration if the version string changes at all (Major, Minor, or Patch)
        isMigration = lastVersionStr !== newVersionStr;
    }

    // Parallel Initialization of core configurations and feature modules
    // This reduces startup time by loading independent configs concurrently.
    await initializeConfigManager(isMigration);
    await Promise.all([
        loadKitsConfig(isMigration),
        loadShopConfig(isMigration),
        loadRanksConfig(isMigration),
        loadSpawnConfig(isMigration),
        loadEconomyConfig(isMigration),
        loadTeamConfig(isMigration),
        loadSidebarConfig(isMigration),
        loadXrayConfig(isMigration),
        loadAuctionHouseConfig(isMigration),
        loadDailyRewardsConfig(isMigration),
        loadWorldProtectionConfig(isMigration),
        import('@features/anticheat/index.js').then((m) => m.initialize(isMigration))
    ]);

    const config = getConfig();
    setLogLevel(config.logLevel);

    mc.world.setDynamicProperty('exe:lastVersion', newVersionStr);

    dataManager.initializeDataManager();
    loadPersistentData();

    initializeMigration();

    const { initializePlayerCache } = await import('@core/playerCache.js');
    initializePlayerCache();

    initializeFeatureDependencies();
    initializeManagers();

    initializeEventManager();
    initializeSpawnProtection();
    initializeXrayDetection();
    restartAnnouncer();

    reinitializeOnlinePlayers();

    startSystemTimers();
    infoLog('[AddonExe] Addon initialized successfully.');
}

function initializeManagers() {
    rankManager.initialize();
    initializeUIPanels();
}

/**
 * Updates all player ranks.
 * This is useful when ranks are changed via commands.
 */
export function updateAllPlayerRanks() {
    const config = getConfig();
    for (const player of mc.world.getAllPlayers()) {
        rankManager.updatePlayerNameTag(player, config);
    }
}

function cleanupAddon() {
    infoLog('[AddonExe] SCRIPT_UNLOAD detected. Cleaning up timers and events...');
    cleanupSpawnProtection();
    cleanupFloatingText();
    cleanupPlayerDataManager();
    sidebarManager.cleanup();
    cleanupLeaderboardManager();
    cleanupEventManager();
    cleanupTimers();
    infoLog('[AddonExe] Cleanup complete. The script will now unload.');
}

mc.system.runTimeout(() => {
    void (async () => {
        try {
            await initializeAddon();
        } catch (error: unknown) {
            errorLog('[AddonExe] A critical error occurred during addon initialization:');
            if (error instanceof Error) {
                errorLog(`Message: ${error.message}`);
                if (error.stack !== undefined) errorLog(`Stack: ${error.stack}`);
            } else {
                errorLog(`Error: ${String(error)}`);
            }
            mc.world.sendMessage('§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.');
        }
    })();
}, 0);

mc.system.beforeEvents.shutdown.subscribe(() => {
    cleanupAddon();
});
