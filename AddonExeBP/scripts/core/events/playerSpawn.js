import { world, system } from '@minecraft/server';
import { getPunishment } from '../punishmentManager.js';
import * as playerCache from '../playerCache.js';
import * as playerDataManager from '../playerDataManager.js';
import * as rankManager from '../rankManager.js';
import { updatePlayerRank } from '../main.js';
import { getConfig } from '../configManager.js';
import { formatString } from '../utils.js';
import { errorLog } from '../logger.js';
import { debugLog } from '../logger.js';

export const eventName = 'playerSpawn';

async function handlePlayerSpawn(event) {
    const { player, initialSpawn } = event;
    playerCache.addPlayerToCache(player);

    // Ban check
    const punishment = getPunishment(player.id);
    if (punishment?.type === 'ban') {
        const remainingTime = Math.round((punishment.expires - Date.now()) / 1000);
        const durationText = punishment.expires === Infinity ? 'permanently' : `for another ${remainingTime} seconds`;

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

    // Check for a death location to message the player after a brief delay.
    system.runTimeout(() => {
        const freshPlayer = world.getAllPlayers().find(p => p.id === player.id);
        if (!freshPlayer) { return; }

        const freshPData = playerDataManager.getPlayer(player.id);

        if (freshPData && freshPData.lastDeathLocation && !freshPData.deathNotificationSent) {
            const location = freshPData.lastDeathLocation;
            const config = getConfig();
            const context = {
                x: location.x.toFixed(2),
                y: location.y.toFixed(2),
                z: location.z.toFixed(2),
                dimensionId: location.dimensionId.replace('minecraft:', '')
            };
            const message = formatString(config.playerInfo.deathCoordsMessage, context);
            freshPlayer.sendMessage(message);

            playerDataManager.setDeathNotificationSent(player.id, true);
        }
    }, 1);
}

export default handlePlayerSpawn;