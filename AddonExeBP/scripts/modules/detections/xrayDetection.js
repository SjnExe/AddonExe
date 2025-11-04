import { world } from '@minecraft/server';
import { getXrayConfig } from '../../core/configurations.js';
import { getPlayer } from '../../core/playerDataManager.js';
import { getAllPlayersFromCache } from '../../core/playerCache.js';
import { sendMessage } from '../../core/messaging.js';
import { warnLog, debugLog } from '../../core/logger.js';
import { xrayConfig as xrayDefaultConfig } from '../../core/xrayConfig.js';

function handleBlockBreak(event) {
    const { player, brokenBlockPermutation, block } = event;
    const blockId = brokenBlockPermutation.type.id;
    const dimensionId = player.dimension.id;

    // Detailed logging for every block break to help diagnose issues.
    debugLog(`[X-Ray Debug] Player ${player.name} broke ${blockId} in dimension ${dimensionId} at ${block.location.x.toFixed(2)}, ${block.location.y.toFixed(2)}, ${block.location.z.toFixed(2)}`);
    if (blockId === 'minecraft:netherrack') {
        debugLog(`[X-Ray Debug] Netherrack broken. Player is confirmed to be in the Nether dimension.`);
    }

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

        debugLog(`[X-Ray Debug] Matched broken block ${blockId} with ore type '${oreTypeKey}'.`);

        // Check if the dimension matches.
        if (monitoredBlock.dimensionId !== dimensionId) {
            debugLog(`[X-Ray Debug] Dimension mismatch for ${blockId}. Expected ${monitoredBlock.dimensionId}, but player is in ${dimensionId}.`);
            continue;
        }

        // Check if the Y-level is within the monitored range.
        if (block.location.y < monitoredBlock.minY || block.location.y > monitoredBlock.maxY) {
            debugLog(`[X-Ray Debug] Y-level out of range for ${blockId}. Y-level ${block.location.y} is not between ${monitoredBlock.minY} and ${monitoredBlock.maxY}.`);
            continue;
        }

        // All checks passed. This is a valid detection.
        debugLog(`[X-Ray Debug] All checks passed for ${blockId}. Sending notification.`);
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
            const pData = getPlayer(onlinePlayer.id);
            if (pData && pData.permissionLevel <= 2 && pData.xrayNotificationsEnabled) {
                sendMessage(message, onlinePlayer);
            }
        }

        // Ore found and handled, no need to check other types.
        return;
    }
}

export function initializeXrayDetection() {
    world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
