import * as mc from '@minecraft/server';

import { loadCommands } from '@core/commands/index.js';
import { initializeXrayDetection } from '@features/anticheat/xrayDetection.js';
import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { cleanupSpawnProtection, initializeSpawnProtection } from '@features/essentials/spawnProtection.js';
import { isNonEmptyString } from '@lib/guards.js';
import { getConfig, initializeConfigManager } from './configManager.js';
import {
    loadAuctionHouseConfig,
    loadDailyRewardsConfig,
    loadEconomyConfig,
    loadGamesConfig,
    loadKitsConfig,
    loadRanksConfig,
    loadShopConfig,
    loadSidebarConfig,
    loadSpawnConfig,
    loadTeamConfig,
    loadXrayConfig
} from './configurations.js';
import { dataManager, loadPersistentData } from './dataManager.js';
import { cleanupEventManager, initializeEventManager } from './events/eventManager.js';
import { initializeFeatureDependencies } from './featureDependencies.js';
import { cleanup as cleanupFloatingText } from './floatingTextManager.js';
import { cleanupLeaderboardManager } from './leaderboardManager.js';
import { errorLog, infoLog, setLogLevel } from './logger.js';
import { initializeMigration } from './migrationManager.js';
import { cleanupPlayerDataManager } from './playerDataManager.js';
import * as rankManager from './rankManager.js';
import * as sidebarManager from './sidebarManager.js';
import { cleanupTimers, startSystemTimers } from './timerManager.js';
import { initialize as initializeUIPanels } from './ui/panels/index.js';
import { reinitializeOnlinePlayers } from './utils.js';

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
        loadGamesConfig(isMigration),
        import('@features/anticheat/index.js').then((m) => m.initialize(isMigration))
    ]);

    const config = getConfig();
    setLogLevel(config.logLevel);

    mc.world.setDynamicProperty('exe:lastVersion', newVersionStr);

    dataManager.initializeDataManager();
    loadPersistentData();

    initializeMigration();

    const { initializePlayerCache } = await import('./playerCache.js');
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
