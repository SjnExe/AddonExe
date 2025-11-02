import { world } from '@minecraft/server';
import { getXrayConfig } from '../../core/configurations.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { getAllPlayersFromCache } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';

function handleBlockBreak(event) {
    const { player, brokenBlock } = event;
    const xrayConfig = getXrayConfig();

    if (!xrayConfig.enabled) {
        return;
    }

    const monitoredOre = xrayConfig.monitoredOres.find(ore => ore.blockId === brokenBlock.typeId);

    if (!monitoredOre) {
        return;
    }

    if (monitoredOre.dimensionId !== player.dimension.id) {
        return;
    }

    if (brokenBlock.location.y < monitoredOre.minY || brokenBlock.location.y > monitoredOre.maxY) {
        return;
    }

    const onlinePlayers = getAllPlayersFromCache();
    for (const onlinePlayer of onlinePlayers) {
        const pData = getPlayer(onlinePlayer.id);
        if (pData && pData.permissionLevel <= 2 && pData.xrayNotificationsEnabled) {
            const message = xrayConfig.notificationMessage
                .replace('{playerName}', player.name)
                .replace('{oreName}', monitoredOre.oreName)
                .replace('{x}', brokenBlock.location.x.toFixed(2))
                .replace('{y}', brokenBlock.location.y.toFixed(2))
                .replace('{z}', brokenBlock.location.z.toFixed(2));
            sendMessage(onlinePlayer, message);
        }
    }
}

export function initializeXrayDetection() {
    world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
