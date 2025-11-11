import * as mc from '@minecraft/server';
import { getOrCreatePlayer } from '../playerDataManager.js';
import { updatePlayerRank } from '../main.js';
import { debugLog, infoLog } from '../logger.js';
import { getPunishment, initializePunishmentManager } from '../punishmentManager.js';
import { initializeReportManager } from '../reportManager.js';
import { initializeCooldownManager } from '../cooldownManager.js';
import { getConfig } from '../configManager.js';
import { formatLocation } from '../utils.js';
import { sendMessage } from '../messaging.js';

let isFirstPlayerJoined = false;

function onFirstPlayerJoin() {
    infoLog('[Add-on] First player has joined. Finalizing manager initializations.');
    // These were deferred to prevent race conditions on world load
    initializePunishmentManager();
    initializeReportManager();
    initializeCooldownManager();
}

/**
 * Handles all logic that should run when a player joins the server.
 * @param {import('@minecraft/server').Player} player The player who joined.
 */
function handlePlayerJoin(player) {
    const pData = getOrCreatePlayer(player);
    debugLog(`[Add-on] Player ${player.name} joined with rank ${pData.rankId}.`);

    // 1. Check for bans
    const punishment = getPunishment(player.id);
    if (punishment?.type === 'ban') {
        const banReason = punishment.reason || 'You are banned.';
        // Kick the player after a short delay to ensure the message is sent
        mc.system.runTimeout(() => player.kick(banReason), 5);
        return; // Stop further processing for banned players
    }

    // 2. Send welcome message
    const config = getConfig();
    if (config.welcomeMessage?.enabled && config.welcomeMessage?.message) {
        sendMessage(config.welcomeMessage.message, player);
    }

    // 3. Inform about pending death coordinates
    if (pData.lastDeathLocation && !pData.deathNotificationSent) {
        const formattedCoords = formatLocation(pData.lastDeathLocation);
        sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.`, player);
        pData.deathNotificationSent = true;
        // No need to save here, as it's not a critical data change.
        // It will be saved on the next auto-save or on player leave.
    }

    // 4. Defer rank update by a tick to prevent race conditions
    mc.system.runTimeout(() => {
        try {
            updatePlayerRank(player);
        } catch (e) {
            // This can sometimes fail if the player object isn't fully ready.
            // It's usually harmless as ranks are updated periodically.
        }
    }, 1);
}


/**
 * Subscribes to the player spawn event to handle player initialization.
 */
export function initializePlayerSpawnEvent() {
    mc.world.afterEvents.playerSpawn.subscribe(event => {
        const { player, initialSpawn } = event;

        if (initialSpawn) {
            if (!isFirstPlayerJoined) {
                isFirstPlayerJoined = true;
                // Defer by one tick to ensure the world is fully ready
                mc.system.runTimeout(onFirstPlayerJoin, 1);
            }
            handlePlayerJoin(player);
        }
    });
}
