import * as mc from '@minecraft/server';

import { restartAnnouncer } from '../modules/commands/announcement.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';
import { initializeXrayDetection } from '../modules/detections/xrayDetection.js';

import * as bountyManager from './bountyManager.js';
import { loadConfig } from './configLoader.js';
import { getConfig, initializeConfigManager } from './configManager.js';
import {
    getSpawnConfig,
    loadEconomyConfig,
    loadKitsConfig,
    loadRanksConfig,
    loadShopConfig,
    loadSpawnConfig,
    loadXrayConfig
} from './configurations.js';
import { loadCooldowns, clearExpiredCooldowns } from './cooldownManager.js';
import * as dataManager from './dataManager.js';
import { initializeEventManager, cleanupEventManager } from './events/eventManager.js';
import { floatingTextManager } from './floatingTextManager.js';
import { errorLog, setLogLevel, infoLog } from './logger.js';
import { initializeMigration } from './migrationManager.js';
import {
    getOrCreatePlayer,
    setPlayerRank,
    cleanupPlayerDataManager,
    clearExpiredPayments,
    loadNameIdMap,
    initializeLeaderboard
} from './playerDataManager.js';
import { loadPunishments, clearExpiredPunishments, initializePunishmentManager } from './punishmentManager.js';
import * as rankManager from './rankManager.js';
import { loadReports, clearOldResolvedReports } from './reportManager.js';
import * as teamManager from './teamManager.js';
import { cleanupTimers, setTrackedInterval } from './timerManager.js';
import '../modules/commands/index.js';
import './mobDeathEvents.js';

export function updatePlayerRank(player: mc.Player) {
    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return;
    }

    const config = getConfig();
    if (!config) {
        return;
    }
    const oldRankId = pData.rankId;
    const newRank = rankManager.getPlayerRank(player, config);

    if (oldRankId !== newRank.id) {
        setPlayerRank(player.id, newRank.id, newRank.permissionLevel);
        infoLog(`[AddonExe] Player ${player.name}'s rank updated from ${oldRankId} to ${newRank.name}.`);
        player.sendMessage(`§aYour rank has been updated to ${newRank.name}.`);
    }
    rankManager.updatePlayerNameTag(player, config);
}

export function updateAllPlayerRanks() {
    for (const player of mc.world.getAllPlayers()) {
        updatePlayerRank(player);
    }
}

function reinitializeOnlinePlayers() {
    infoLog(`[AddonExe] Re-initializing state for ${mc.world.getAllPlayers().length} online players...`);
    for (const player of mc.world.getAllPlayers()) {
        getOrCreatePlayer(player);
        updatePlayerRank(player);
    }
    infoLog('[AddonExe] Player re-initialization complete.');
}

function loadPersistentData() {
    infoLog('[AddonExe] Loading persistent data...');
    loadNameIdMap();
    loadPunishments();
    loadReports();
    loadCooldowns();
    bountyManager.loadBounties();
    initializeLeaderboard();
}

function initializeManagers() {
    infoLog('[AddonExe] Initializing managers...');
    rankManager.initialize();
    initializePunishmentManager();
    floatingTextManager.initialize();
    teamManager.initialize();
    clearExpiredPunishments();
    clearOldResolvedReports();
    clearExpiredCooldowns();
    clearExpiredPayments();
}

async function checkConfiguration() {
    const config = getConfig();
    const spawnConfig = getSpawnConfig();

    const ownerNames = config?.ownerPlayerNames;
    const isOwnerConfigured =
        Array.isArray(ownerNames) &&
        ownerNames.length > 0 &&
        (ownerNames.length > 1 || ownerNames[0] !== 'Your•Name•Here');

    if (!isOwnerConfigured) {
        const warningMessage =
            '§l§c[AddonExe] WARNING: No owner is configured. Please set `ownerPlayerNames` in `scripts/config.js` to gain access to admin commands.';
        mc.system.runTimeout(() => mc.world.sendMessage(warningMessage), 20);
        errorLog('[AddonExe] No owner configured.');
    }

    if (!spawnConfig.spawn || !spawnConfig.spawn.spawnLocation) {
        const spawnWarning =
            '§l§e[AddonExe] NOTICE: The server spawn has not been set. Spawn protection and the /spawn command will not function until an admin runs /setspawn.';
        mc.system.runTimeout(() => mc.world.sendMessage(spawnWarning), 40);
        errorLog('[AddonExe] Server spawn not set.');
    }
}

function startSystemTimers() {
    setTrackedInterval(clearExpiredPayments, 60 * 20);
    infoLog('[AddonExe] System timers started.');
}

async function initializeAddon() {
    infoLog('[AddonExe] Initializing addon...');

    const tempConfig: any = await loadConfig('../config.js');
    const newVersion = String(tempConfig.version);
    const lastVersion = mc.world.getDynamicProperty('exe:lastVersion') as string | undefined;
    const isMigration = !lastVersion || lastVersion !== newVersion;

    await initializeConfigManager(isMigration);
    await loadKitsConfig(isMigration);
    await loadShopConfig(isMigration);
    await loadRanksConfig(isMigration);
    await loadSpawnConfig(isMigration);
    await loadEconomyConfig(isMigration);
    await loadXrayConfig(isMigration);

    const config = getConfig();
    setLogLevel(config.logLevel);

    mc.world.setDynamicProperty('exe:lastVersion', newVersion);

    dataManager.initializeDataManager();
    loadPersistentData();

    initializeMigration();

    const { initializePlayerCache } = await import('./playerCache.js');
    initializePlayerCache();

    initializeManagers();
    await checkConfiguration();
    initializeEventManager();
    initializeSpawnProtection();
    initializeXrayDetection();
    restartAnnouncer();

    reinitializeOnlinePlayers();

    startSystemTimers();
    infoLog('[AddonExe] Addon initialized successfully.');
}

function cleanupAddon() {
    console.log('[AddonExe] SCRIPT_UNLOAD detected. Cleaning up timers and events...');
    floatingTextManager.cleanup();
    cleanupPlayerDataManager();
    cleanupEventManager();
    cleanupTimers();
    console.log('[AddonExe] Cleanup complete. The script will now unload.');
}

mc.system.runTimeout(async () => {
    try {
        await initializeAddon();
    } catch (e: any) {
        errorLog('[AddonExe] A critical error occurred during addon initialization:');
        errorLog(e.stack);
        mc.world.sendMessage(
            '§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.'
        );
    }
}, 0);

mc.system.afterEvents.scriptEventReceive.subscribe((event: any) => {
    const { id } = event;

    if (id === 'minecraft:script_unload') {
        cleanupAddon();
        return;
    }
});
