import * as mc from '@minecraft/server';
import { getXrayConfig } from '../../core/configurations.js';
import { getOrCreatePlayer } from '../../core/playerDataManager.js';
import { getAllPlayersFromCache } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';
import { warnLog } from '../../core/logger.js';
import { xrayConfig as xrayDefaultConfig } from '../../core/xrayConfig.js';

function handleBlockBreak(event) {
    const { player, brokenBlockPermutation, block } = event;
    const blockId = brokenBlockPermutation.type.id;
    const dimensionId = player.dimension.id;

    const xrayConfig = getXrayConfig();
    if (!xrayConfig?.monitoredOreTypes) {
        return;
    }

    // Iterate over each configured ore type (e.g., 'diamond', 'ancientDebris').
    for (const oreTypeKey in xrayConfig.monitoredOreTypes) {
        const oreType = xrayConfig.monitoredOreTypes[oreTypeKey];

        // First, check if monitoring for this entire ore type is enabled.
        if (!oreType.enabled) {
            continue;
        }

        // Find if the broken block matches any block defined for this type.
        const monitoredBlock = oreType.blocks.find(b => b.blockId === blockId);

        if (!monitoredBlock) {
            continue; // Not a match, move to the next ore type.
        }

        // Check if the dimension matches.
        if (monitoredBlock.dimensionId !== dimensionId) {
            continue;
        }

        // Check if the Y-level is within the monitored range.
        if (block.location.y < monitoredBlock.minY || block.location.y > monitoredBlock.maxY) {
            continue;
        }

        // All checks passed. This is a valid detection.
        const messageTemplate = xrayConfig.notifications?.message || xrayDefaultConfig.notifications.message;
        const message = messageTemplate
            .replace('{playerName}', player.name)
            .replace('{oreName}', oreType.oreName)
            .replace('{x}', block.location.x.toFixed(2))
            .replace('{y}', block.location.y.toFixed(2))
            .replace('{z}', block.location.z.toFixed(2));

        // Log to console if enabled.
        if (xrayConfig.notifications.logToConsole) {
            warnLog(message);
        }

        // Send a private message to all staff who have notifications enabled.
        const onlinePlayers = getAllPlayersFromCache();
        for (const onlinePlayer of onlinePlayers) {
            const pData = getOrCreatePlayer(onlinePlayer);
            if (pData && pData.permissionLevel <= 2 && pData.xrayNotificationsEnabled) {
                sendMessage(message, onlinePlayer);
            }
        }

        // Ore found and handled, no need to check other types.
        return;
    }
}

export function initializeXrayDetection() {
    mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
