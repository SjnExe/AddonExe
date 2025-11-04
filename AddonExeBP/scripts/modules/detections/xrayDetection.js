import { world } from '@minecraft/server';
import { getXrayConfig } from '../../core/configurations.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { getAllPlayersFromCache } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';
import { warnLog } from '../../core/logger.js';
import { xrayConfig as xrayDefaultConfig } from '../../core/xrayConfig.js';

function handleBlockBreak(event) {
    const { player, brokenBlockPermutation, block } = event;
    const xrayConfig = getXrayConfig();

    if (!xrayConfig || !xrayConfig.enabled) {
        return;
    }

    const monitoredOre = xrayConfig.monitoredOres.find(ore => ore.blockId === brokenBlockPermutation.type.id);

    if (!monitoredOre) {
        return;
    }

    if (monitoredOre.dimensionId !== player.dimension.id) {
        return;
    }

    if (block.location.y < monitoredOre.minY || block.location.y > monitoredOre.maxY) {
        return;
    }

    // Use default message if the configured one is empty or missing.
    const messageTemplate = xrayConfig.notifications?.message || xrayDefaultConfig.notifications.message;

    const message = messageTemplate
        .replace('{playerName}', player.name)
        .replace('{oreName}', monitoredOre.oreName)
        .replace('{x}', block.location.x.toFixed(2))
        .replace('{y}', block.location.y.toFixed(2))
        .replace('{z}', block.location.z.toFixed(2));

    if (xrayConfig.notifications.logToConsole) {
        warnLog(message);
    }

    const onlinePlayers = getAllPlayersFromCache();
    for (const onlinePlayer of onlinePlayers) {
        const pData = getPlayer(onlinePlayer.id);
        // Permission level 2 is 'admin', 1 is 'moderator'
        if (pData && pData.permissionLevel <= 2 && pData.xrayNotificationsEnabled) {
            sendMessage(message, onlinePlayer);
        }
    }
}

export function initializeXrayDetection() {
    world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
