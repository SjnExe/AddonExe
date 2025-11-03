import { world } from '@minecraft/server';
import { getXrayConfig } from '../../core/configurations.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { getAllPlayersFromCache } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';

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

    const message = xrayConfig.notifications.message
        .replace('{playerName}', player.name)
        .replace('{oreName}', monitoredOre.oreName)
        .replace('{x}', block.location.x.toFixed(2))
        .replace('{y}', block.location.y.toFixed(2))
        .replace('{z}', block.location.z.toFixed(2));

    if (xrayConfig.notifications.logToConsole) {
        // The logger will handle the formatting, so we just send the raw message.
        console.warn(message);
    }

    const onlinePlayers = getAllPlayersFromCache();
    for (const onlinePlayer of onlinePlayers) {
        const pData = getPlayer(onlinePlayer.id);
        // Permission level 2 is 'admin', 1 is 'moderator'
        if (pData && pData.permissionLevel <= 2 && pData.xrayNotificationsEnabled) {
            sendMessage(onlinePlayer.name, message);
        }
    }
}

export function initializeXrayDetection() {
    world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
