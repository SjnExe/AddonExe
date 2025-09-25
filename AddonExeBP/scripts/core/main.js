import { world, system } from '@minecraft/server';
import { config as defaultConfig } from '../config.js';
import { loadConfig, getConfig, updateConfig, reloadConfig } from './configManager.js';
import { loadShopConfig } from './shopConfigManager.js';
import { loadKitsConfig } from './kitsConfigManager.js';
import { loadRanksConfig } from './ranksConfigManager.js';
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
import { initializeEventManager } from '../events/eventManager.js';
import '../modules/commands/index.js';

/**
 * Checks a player's rank and updates it if necessary.
 * @param {import('@minecraft/server').Player} player The player to check.
 */
export function updatePlayerRank(player) {
    const pData = playerDataManager.getPlayer(player.id);
    if (!pData) {return;}

    const config = getConfig();
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
    if (!config.ownerPlayerNames || config.ownerPlayerNames.length === 0 || config.ownerPlayerNames[0] === 'Your•Name•Here') {
        const warningMessage = '§l§c[AddonExe] WARNING: No owner is configured. Please set `ownerPlayerNames` in `scripts/config.js` to gain access to admin commands.';
        system.runTimeout(() => world.sendMessage(warningMessage), 20);
        errorLog('[AddonExe] No owner configured.');
    }
}

/**
 * Starts all recurring system timers.
 */
function startSystemTimers() {
    // Periodically clear expired payment confirmations
    system.runInterval(economyManager.clearExpiredPayments, 6000); // 5 minutes
    // Rank updates are now handled by events (e.g., !admin command)
    debugLog('[AddonExe] System timers started.');
}

/**
 * Main entry point for addon initialization.
 */
function initializeAddon() {
    debugLog('[AddonExe] Initializing addon...');

    const newVersion = String(defaultConfig.version);
    const lastVersion = world.getDynamicProperty('exe:lastVersion');
    const isMigration = !lastVersion || lastVersion !== newVersion;

    const isFirstInit = loadConfig(isMigration);
    loadKitsConfig(isMigration);
    loadShopConfig(isMigration);
    loadRanksConfig(isMigration);

    if (!isFirstInit && !isMigration) {
        reloadConfig();
    }

    world.setDynamicProperty('exe:lastVersion', newVersion);

    dataManager.initializeDataManager();
    loadPersistentData();
    initializeManagers();
    checkConfiguration();
    initializeEventManager();

    startSystemTimers();
    debugLog('[AddonExe] Addon initialized successfully.');
}

// Run the initialization logic on the next tick after the script is loaded.
system.run(initializeAddon);

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id, sourceEntity } = event;

    switch (id) {
        case 'exe:restart':
            startRestart(sourceEntity);
            break;

        case 'exe:toggle_chat_log': {
            const config = getConfig();
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
                sourceEntity.addTag(getConfig().adminTag);
                sourceEntity.sendMessage('§aYou have been promoted to Admin.');
                updateAllPlayerRanks();
            }
            break;
        }
    }
});