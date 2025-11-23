import * as mc from '@minecraft/server';
import { getXrayConfig } from '../../core/configurations.js';
import { getOrCreatePlayer } from '../../core/playerDataManager.js';
import { getAllPlayersFromCache } from '../../core/playerCache.js';
import { warnLog, debugLog } from '../../core/logger.js';
import { formatString } from '../../core/utils.js';

// Map<playerId, Map<oreName, { count: number, timerId: number, blockLocation: Vector3, oreType: object }>>
const alertBuffers = new Map();

/**
 * Sends the X-Ray alert to console and qualified staff.
 * @param {import('@minecraft/server').Player} player The player who mined the ore.
 * @param {object} oreType The ore configuration object.
 * @param {import('@minecraft/server').Vector3} location The location of the block.
 * @param {number} count The number of blocks mined in the buffer period.
 */
function sendAlert(player, oreType, location, count) {
    const xrayConfig = getXrayConfig();

    // The message format should be hardcoded as per user request, bypassing config.
    // §7{playerName}§r mined §e{count} {oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r
    const oreDisplay = oreType.oreName; // We use the ore name directly, count is handled in the template

    const context = {
        playerName: player.name,
        oreName: oreDisplay,
        count: count,
        x: location.x.toFixed(2),
        y: location.y.toFixed(2),
        z: location.z.toFixed(2)
    };

    // HARDCODED TEMPLATE
    const messageTemplate = '§7{playerName}§r mined §e{count} {oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r';
    const message = formatString(messageTemplate, context);

    // Log to console if enabled.
    if (xrayConfig.notifications.logToConsole) {
        warnLog(message);
    }

    // Send a private message to all staff who have notifications enabled.
    const onlinePlayers = getAllPlayersFromCache();
    for (const onlinePlayer of onlinePlayers) {
        // The user requested self-alerting capability for testing, so we do NOT skip the miner.
        // if (onlinePlayer.id === player.id) { continue; }

        const pData = getOrCreatePlayer(onlinePlayer);
        const requiredLevel = xrayConfig.notifications.alertPermissionLevel ?? 2;

        if (pData) {
            const hasPermission = pData.permissionLevel <= requiredLevel;
            const isEnabled = pData.xrayNotificationsEnabled;

            // --- Temporary Debug Logging as requested by user ---
            // Log decision logic for every staff/potential staff member
            if (pData.permissionLevel <= 1024) { // Only log for members/staff, ignore visitors if any
                const status = (hasPermission && isEnabled) ? '§aACCEPTED' : '§cSKIPPED';
                const reason = !hasPermission ? `Low Perm (Level ${pData.permissionLevel} > ${requiredLevel})`
                    : !isEnabled ? 'Notifications Disabled'
                    : 'Unknown';
                debugLog(`[X-Ray Debug] ${status} ${onlinePlayer.name}: ${reason}`);
            }
            // ----------------------------------------------------

            if (hasPermission && isEnabled) {
                // Use direct sendMessage on the player object to bypass any potential wrapper issues
                try {
                    // The user reported missing notifications; bypassing wrapper ensures it goes through if the player object is valid.
                    // However, getAllPlayersFromCache returns cached objects which might be stale references if not careful.
                    // But playerCache usually refreshes. To be safe, we find the real player in the world.
                    const realPlayer = mc.world.getAllPlayers().find(p => p.id === onlinePlayer.id);
                    if (realPlayer) {
                        realPlayer.sendMessage(message);
                    } else {
                        debugLog(`[X-Ray] Could not find real player object for ${onlinePlayer.name} to send alert.`);
                    }
                } catch (e) {
                    warnLog(`Failed to send X-Ray alert to ${onlinePlayer.name}: ${e}`);
                }
            }
        }
    }
}

function flushAlert(playerId, oreKey) {
    const playerBuffer = alertBuffers.get(playerId);
    if (!playerBuffer) {return;}
    const data = playerBuffer.get(oreKey);
    if (!data) {return;}

    playerBuffer.delete(oreKey);
    if (playerBuffer.size === 0) {alertBuffers.delete(playerId);}

    const player = mc.world.getAllPlayers().find(p => p.id === playerId);
    if (!player) {return;} // Player likely left

    sendAlert(player, data.oreType, data.blockLocation, data.count);
}

function bufferAlert(player, oreType, block) {
    const playerId = player.id;
    const xrayConfig = getXrayConfig();
    // Convert seconds to ticks (20 ticks/sec). Default to 0 if not set.
    const bufferTime = (xrayConfig.notifications.alertBufferingSeconds ?? 0) * 20;

    if (bufferTime <= 0) {
        sendAlert(player, oreType, block.location, 1);
        return;
    }

    if (!alertBuffers.has(playerId)) {
        alertBuffers.set(playerId, new Map());
    }
    const playerBuffer = alertBuffers.get(playerId);
    const oreKey = oreType.oreName;

    if (!playerBuffer.has(oreKey)) {
        const timerId = mc.system.runTimeout(() => {
            flushAlert(playerId, oreKey);
        }, bufferTime);

        playerBuffer.set(oreKey, {
            count: 1,
            timerId,
            blockLocation: { ...block.location },
            oreType
        });
    } else {
        const data = playerBuffer.get(oreKey);
        data.count++;
        data.blockLocation = { ...block.location }; // Update to latest location
    }
}

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
        bufferAlert(player, oreType, block);

        // Ore found and handled, no need to check other types.
        return;
    }
}

export function initializeXrayDetection() {
    mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
