import { world, system } from '@minecraft/server';
import { loadConfig, getConfig, updateConfig, reloadConfig } from './configManager.js';
import { loadShopConfig } from './shopConfigManager.js';
import * as dataManager from './dataManager.js';
import * as rankManager from './rankManager.js';
import * as playerDataManager from './playerDataManager.js';
import { commandManager } from '../modules/commands/commandManager.js';
import { getPunishment, loadPunishments, clearExpiredPunishments } from './punishmentManager.js';
import { loadReports, clearOldResolvedReports } from './reportManager.js';
import { loadCooldowns, clearExpiredCooldowns } from './cooldownManager.js';
import * as economyManager from './economyManager.js';
import * as bountyManager from './bountyManager.js';
import * as lastHitManager from './lastHitManager.js';
import { showPanel } from './uiManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
import * as playerCache from './playerCache.js';
import { startRestart } from './restartManager.js';
import { formatString } from './utils.js';
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
    for (const player of playerCache.getAllPlayersFromCache()) {
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
    const isFirstInit = loadConfig();
    loadShopConfig();
    if (!isFirstInit) {
        reloadConfig();
    }
    dataManager.initializeDataManager();
    loadPersistentData();
    initializeManagers();
    checkConfiguration();

    startSystemTimers();
    debugLog('[AddonExe] Addon initialized successfully.');
}

// Run the initialization logic on the next tick after the script is loaded.
system.run(initializeAddon);

// Handle muted players, commands, and chat formatting
world.beforeEvents.chatSend.subscribe((eventData) => {
    const player = eventData.sender;

    const punishment = getPunishment(player.id);
    if (punishment?.type === 'mute') {
        eventData.cancel = true;
        const remainingTime = Math.round((punishment.expires - Date.now()) / 1000);
        const durationText = punishment.expires === Infinity ? 'permanently' : `for another ${remainingTime} seconds`;
        player.sendMessage(`§cYou are muted ${durationText}. Reason: ${punishment.reason}`);
        return;
    }

    const wasCommand = commandManager.handleChatCommand(eventData);
    if (wasCommand) {return;}

    eventData.cancel = true;
    const pData = playerDataManager.getPlayer(player.id);
    if (!pData) {
        world.sendMessage(`§7${player.name}§r: ${eventData.message}`);
        return;
    }
    const rank = rankManager.getRankById(pData.rankId);
    const formattedMessage = rank
        ? `${rank.chatFormatting.prefixText}${rank.chatFormatting.nameColor}${player.name}§r: ${rank.chatFormatting.messageColor}${eventData.message}`
        : `§7${player.name}§r: ${eventData.message}`;

    // Log to console if enabled
    if (getConfig().chat?.logToConsole) {
        // Using a plain-text version for the console log to avoid clutter from formatting codes
        // eslint-disable-next-line no-console
        console.log(`<${player.name}> ${eventData.message}`);
    }

    world.sendMessage(formattedMessage);
});

world.afterEvents.playerSpawn.subscribe(async (event) => {
    const { player, initialSpawn } = event;
    playerCache.addPlayerToCache(player);

    // Ban check
    const punishment = getPunishment(player.id);
    if (punishment?.type === 'ban') {
        const remainingTime = Math.round((punishment.expires - Date.now()) / 1000);
        const durationText = punishment.expires === Infinity ? 'permanently' : `for another ${remainingTime} seconds`;

        // Use a command-based kick for reliability.
        // A system.run is still good practice to ensure the command runs in a clean context after the spawn event.
        system.run(() => {
            try {
                const sanitizedReason = punishment.reason.replace(/"/g, '\\"');
                world.getDimension('overworld').runCommand(`kick "${player.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
            } catch (error) {
                errorLog(`[BanCheck] Failed to kick banned player ${player.name}:`, error);
            }
        });
        return;
    }

    const pData = playerDataManager.getOrCreatePlayer(player);
    updatePlayerRank(player); // Check and update rank on join

    if (initialSpawn) {
        const rank = rankManager.getRankById(pData.rankId);
        debugLog(`[AddonExe] Player ${player.name} joined with rank ${rank?.name ?? 'unknown'}.`);

        const config = getConfig();
        if (config.playerInfo.enableWelcomer) {
            const context = {
                playerName: player.name,
                serverName: config.serverName,
                discordLink: config.serverInfo.discordLink,
                websiteLink: config.serverInfo.websiteLink
            };
            const welcomeMessage = formatString(config.playerInfo.welcomeMessage, context);
            player.sendMessage(welcomeMessage);
        }
    }

    // Update X-ray notification cache for admins
    if (pData.permissionLevel <= 1 && pData.xrayNotifications) {
        playerCache.addAdminToXrayCache(player.id);
    }

    // Check for a death location to message the player.
    if (pData.lastDeathLocation && !pData.deathNotificationSent) {
        const location = pData.lastDeathLocation;
        const config = getConfig();
        const context = {
            x: Math.floor(location.x),
            y: Math.floor(location.y),
            z: Math.floor(location.z),
            dimensionId: location.dimensionId.replace('minecraft:', '')
        };
        const message = formatString(config.playerInfo.deathCoordsMessage, context);
        player.sendMessage(message);

        // Mark the notification as sent to prevent spamming, but keep the data for /deathcoords.
        playerDataManager.setDeathNotificationSent(player.id, true);
    }
});

world.afterEvents.entityHurt?.subscribe((event) => {
    const { hurtEntity, damageSource } = event;
    const victim = hurtEntity;

    // We only care about players being hurt
    if (victim?.typeId !== 'minecraft:player') {
        return;
    }

    // damageSource contains the damaging entity
    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) {
        return; // No damaging entity to attribute the hit to
    }

    // Determine the actual attacker. If the damage was from a projectile, the
    // projectile is the damagingEntity, and its 'owner' is the attacker.
    const attacker = damagingEntity.owner ?? damagingEntity;

    // Ensure the attacker and victim are both players and not the same person
    if (attacker?.typeId === 'minecraft:player' && attacker.id !== victim.id) {
        lastHitManager.setLastHit(victim.id, attacker.id);
        debugLog(`[LastHit] Recorded hit from attacker ${attacker.name} to victim ${victim.name}`);
    }
});

world.afterEvents.playerLeave.subscribe((event) => {
    playerDataManager.handlePlayerLeave(event.playerId);
    playerCache.removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
});

// Handle the custom admin panel item being used
world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;
    if (itemStack.typeId === 'exe:panel') {
        // Player data is still needed for button permissions inside the panel
        const pData = playerDataManager.getPlayer(player.id);
        if (pData) {
            showPanel(player, 'mainPanel');
        }
    }
});

world.afterEvents.entityDie?.subscribe((event) => {
    const { deadEntity, damageCause } = event;
    if (deadEntity.typeId !== 'minecraft:player') {
        return;
    }

    const deadPlayer = deadEntity;
    const config = getConfig();

    // --- Bounty Claim Logic ---
    try {
        const lastHit = lastHitManager.getLastHit(deadPlayer.id);
        if (!lastHit) {
            return; // No recent combat data for this player
        }

        // Clear the last hit data now that the player has died
        lastHitManager.clearLastHit(deadPlayer.id);

        const timeSinceHit = (Date.now() - lastHit.timestamp) / 1000;
        const creditTimeout = config.bounties?.bountyCreditTimeoutSeconds ?? 15;

        if (timeSinceHit > creditTimeout) {
            debugLog(`[BountyClaim] Kill credit for ${deadPlayer.name} expired. Time since last hit: ${timeSinceHit}s`);
            return; // Hit was too long ago
        }

        const killer = playerCache.getPlayerFromCache(lastHit.attackerId);
        if (killer && killer.isValid && killer.id !== deadPlayer.id) {
            const bounty = bountyManager.getBounty(deadPlayer.id);
            if (bounty && bounty.amount > 0) {
                economyManager.addBalance(killer.id, bounty.amount);
                bountyManager.removeBounty(deadPlayer.id);

                world.sendMessage(`§a${killer.name} has claimed the bounty of §e$${bounty.amount.toFixed(2)}§a on ${deadPlayer.name}!`);
                debugLog(`[BountyClaim] ${killer.name} claimed bounty on ${deadPlayer.name} for $${bounty.amount}.`);
            }
        }
    } catch (e) {
        errorLog(`[BountyClaim] A fatal error occurred during bounty processing.`);
        // Attempt to stringify the error object for maximum detail.
        try {
            errorLog(`[BountyClaim] Raw Error: ${JSON.stringify(e, Object.getOwnPropertyNames(e))}`);
        } catch (stringifyError) {
            errorLog(`[BountyClaim] Could not stringify error object. Message: ${e?.message}`);
        }
        errorLog(`[BountyClaim] Error Stack: ${e?.stack}`);
    }


    // --- Death Coords Logic ---
    if (config.playerInfo.enableDeathCoords) {
        const pData = playerDataManager.getPlayer(deadPlayer.id);
        if (pData) {
            const deathLocation = {
                x: deadPlayer.location.x,
                y: deadPlayer.location.y,
                z: deadPlayer.location.z,
                dimensionId: deadPlayer.dimension.id
            };
            playerDataManager.setPlayerLastDeathLocation(deadPlayer.id, deathLocation);
        }
    }
});

world.afterEvents.blockBreak?.subscribe((event) => {
    const { brokenBlock, player } = event;
    const valuableOres = [
        'minecraft:diamond_ore',
        'minecraft:deepslate_diamond_ore',
        'minecraft:ancient_debris'
    ];

    if (valuableOres.includes(brokenBlock.typeId)) {
        const onlineAdmins = playerCache.getXrayAdmins();
        if (onlineAdmins.length === 0) {return;}

        const location = brokenBlock.location;
        const message = `§e${player.name}§r mined §e${brokenBlock.typeId.replace('minecraft:', '')}§r at §bX: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)}`;

        onlineAdmins.forEach(admin => {
            // Don't notify the admin if they are the one mining
            if (admin.id !== player.id) {
                admin.sendMessage(message);
            }
        });
    }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id, sourceEntity } = event;

    switch (id) {
        case 'exe:restart':
            // The script event can be triggered by a player or a command block.
            // If it's a player, we can use their entity as the initiator.
            // If it's a command block, sourceEntity will be undefined.
            // The startRestart function can handle a null initiator.
            startRestart(sourceEntity);
            break;

        case 'exe:toggle_chat_log': {
            const config = getConfig();
            const chatConfig = config.chat || { logToConsole: false };
            const newValue = !chatConfig.logToConsole;
            chatConfig.logToConsole = newValue;
            updateConfig('chat', chatConfig);

            const feedbackMessage = `§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`;
            // Notify the entity that triggered the event, if possible
            if (sourceEntity && sourceEntity.sendMessage) {
                sourceEntity.sendMessage(feedbackMessage);
            }
            // Also log it to console for confirmation from non-player sources
            // eslint-disable-next-line no-console
            console.log(`[AddonExe] ${feedbackMessage}`);
            break;
        }

        case 'exe:grant_admin_self': {
            if (sourceEntity && sourceEntity.addTag) {
                sourceEntity.addTag(getConfig().adminTag);
                sourceEntity.sendMessage('§aYou have been promoted to Admin.');
                // Update ranks for everyone to ensure changes are reflected
                updateAllPlayerRanks();
            }
            break;
        }
    }
});
