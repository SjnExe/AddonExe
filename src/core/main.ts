/* eslint-disable @typescript-eslint/require-await */
import * as mc from '@minecraft/server';

import * as kitsFeature from '../features/kits/index.js';
import * as moderationFeature from '../features/moderation/index.js';
import {
    checkAndKickBannedPlayer,
    clearExpiredPunishments,
    initializePunishmentManager,
    loadPunishments
} from '../features/moderation/punishmentManager.js';
import { clearOldResolvedReports, loadReports } from '../features/moderation/reportManager.js';
import * as shopFeature from '../features/shop/index.js';
import { registerFriendlyFire } from '../features/teams/friendlyFire.js';
import * as teamManager from '../features/teams/teamManager.js';
import * as teleportFeature from '../features/teleportation/index.js';
import { restartAnnouncer } from '../modules/commands/announcement.js';
import { loadCommands } from '../modules/commands/index.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';
import { initializeXrayDetection } from '../modules/detections/xrayDetection.js';
import * as corePanels from './ui/panels/index.js';

import * as economyFeature from '../features/economy/index.js';
import * as bountyManager from './bountyManager.js';
import { loadConfig } from './configLoader.js';
import { getConfig, initializeConfigManager } from './configManager.js';
import {
    getSpawnConfig,
    loadEconomyConfig,
    loadKitsConfig,
    loadRanksConfig,
    loadShopConfig,
    loadSidebarConfig,
    loadSpawnConfig,
    loadTeamConfig,
    loadXrayConfig
} from './configurations.js';
import { clearExpiredCooldowns, loadCooldowns } from './cooldownManager.js';
import * as dataManager from './dataManager.js';
import { cleanupEventManager, initializeEventManager } from './events/eventManager.js';
import { floatingTextManager } from './floatingTextManager.js';
import { cleanupLeaderboardManager, initializeLeaderboard } from './leaderboardManager.js';
import { errorLog, infoLog, setLogLevel } from './logger.js';
import { initializeMigration } from './migrationManager.js';
import {
    cleanupPlayerDataManager,
    clearExpiredPayments,
    getOrCreatePlayer,
    loadNameIdMap,
    setPlayerRank
} from './playerDataManager.js';
import * as rankManager from './rankManager.js';
import * as sidebarManager from './sidebarManager.js';
import { cleanupTimers, setTrackedInterval } from './timerManager.js';

import type { config as Config } from '../config.default.js';
import './mobDeathEvents.js';

// Load commands immediately to ensure they are registered before the startup event fires.
loadCommands();

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

    // Update if rank ID changed OR if the permission level of the current rank has changed in config
    if (oldRankId !== newRank.id || pData.permissionLevel !== newRank.permissionLevel) {
        setPlayerRank(player.id, newRank.id, newRank.permissionLevel);
        if (oldRankId !== newRank.id) {
            infoLog(`[AddonExe] Player ${player.name}'s rank updated from ${oldRankId} to ${newRank.name}.`);
            player.sendMessage(`§aYour rank has been updated to ${newRank.name}.`);
        } else {
            // Permission level update only (silent or debug log)
            infoLog(`[AddonExe] Player ${player.name}'s permission level updated to ${newRank.permissionLevel}.`);
        }
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
        if (checkAndKickBannedPlayer(player)) {
            continue;
        }
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
}

async function initializeManagers() {
    infoLog('[AddonExe] Initializing managers...');
    rankManager.initialize();
    initializePunishmentManager();
    floatingTextManager.initialize();
    teamManager.initialize();
    corePanels.initialize();
    kitsFeature.initialize();
    shopFeature.initialize();
    teleportFeature.initialize();
    moderationFeature.initialize();
    economyFeature.initialize();
    registerFriendlyFire();
    sidebarManager.initialize();
    initializeLeaderboard();
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
        mc.system.runTimeout(() => {
            void mc.world.sendMessage(warningMessage);
        }, 20);
        errorLog('[AddonExe] No owner configured.');
    }

    if (!spawnConfig.spawn || !spawnConfig.spawn.spawnLocation) {
        const spawnWarning =
            '§l§e[AddonExe] NOTICE: The server spawn has not been set. Spawn protection and the /spawn command will not function until an admin runs /setspawn.';
        mc.system.runTimeout(() => {
            void mc.world.sendMessage(spawnWarning);
        }, 40);
        errorLog('[AddonExe] Server spawn not set.');
    }
}

function startSystemTimers() {
    setTrackedInterval(clearExpiredPayments, 60 * 20);
    infoLog('[AddonExe] System timers started.');
}

async function initializeAddon() {
    infoLog('[AddonExe] Initializing addon...');

    const tempConfig = await loadConfig<typeof Config>('./config.js');
    const newVersion = tempConfig.version;
    const newVersionStr = String(newVersion);
    const lastVersionStr = mc.world.getDynamicProperty('exe:lastVersion') as string | undefined;

    let isMigration = true;
    if (lastVersionStr) {
        const lastVersion = lastVersionStr.split(',').map(Number);
        // Only trigger migration if Major or Minor versions differ.
        // Array format is [Major, Minor, Patch]
        if (
            Array.isArray(lastVersion) &&
            lastVersion.length >= 2 &&
            Array.isArray(newVersion) &&
            newVersion.length >= 2
        ) {
            if (lastVersion[0] === newVersion[0] && lastVersion[1] === newVersion[1]) {
                isMigration = false;
            }
        }
    }

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
        import('../features/anticheat/index.js').then((m) => m.initialize(isMigration))
    ]);

    const config = getConfig();
    setLogLevel(config.logLevel);

    mc.world.setDynamicProperty('exe:lastVersion', newVersionStr);

    dataManager.initializeDataManager();
    loadPersistentData();

    initializeMigration();

    const { initializePlayerCache } = await import('./playerCache.js');
    initializePlayerCache();

    await initializeManagers();
    await checkConfiguration();
    initializeEventManager();
    initializeSpawnProtection();
    initializeXrayDetection();
    restartAnnouncer();

    reinitializeOnlinePlayers();

    if (config.isNightly) {
        infoLog('[AddonExe] Nightly build detected.');
    }

    startSystemTimers();
    infoLog('[AddonExe] Addon initialized successfully.');
}

function cleanupAddon() {
    infoLog('[AddonExe] SCRIPT_UNLOAD detected. Cleaning up timers and events...');
    floatingTextManager.cleanup();
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
        } catch (e: unknown) {
            errorLog('[AddonExe] A critical error occurred during addon initialization:');
            if (e instanceof Error) {
                errorLog(`Message: ${e.message}`);
                if (e.stack) errorLog(`Stack: ${e.stack}`);
            } else {
                errorLog(`Error: ${String(e)}`);
            }
            mc.world.sendMessage(
                '§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.'
            );
        }
    })();
}, 0);

mc.system.afterEvents.scriptEventReceive.subscribe((event: unknown) => {
    const { id } = event as { id: string };

    if (id === 'minecraft:script_unload') {
        cleanupAddon();
        return;
    }
});

mc.system.beforeEvents.shutdown.subscribe(() => {
    cleanupAddon();
});
