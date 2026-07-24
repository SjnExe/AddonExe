import * as mc from '@minecraft/server';

import { getXrayConfig } from '@core/configurations.js';
import { hasPermission } from "@core/permissionEngine.js";
import { registerEvent } from '@core/events/eventManager.js';
import { warnLog } from '@core/logger.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer } from '@core/playerDataManager.js';
import { setTrackedTimeout } from '@core/timerManager.js';
import { formatString } from '@core/utils.js';
import { MonitoredOreType } from '@features/anticheat/xrayConfig.js';
import { isDefined } from '@lib/guards.js';

interface AlertData {
    count: number;
    timerId: number;
    blockLocation: mc.Vector3;
    oreType: MonitoredOreType;
}

interface CachedOreInfo {
    oreType: MonitoredOreType;
    minY: number;
    maxY: number;
    dimensionId: string;
}

// Map<BlockId, CachedOreInfo[]>
const oreCache = new Map<string, CachedOreInfo[]>();
const alertBuffers = new Map<string, Map<string, AlertData>>();

/**
 * Rebuilds the fast lookup cache for monitored ores.
 * This should be called whenever the X-Ray configuration changes.
 */
export function refreshXrayCache(): void {
    const xrayConfig = getXrayConfig();
    if (!isDefined(xrayConfig.monitoredOreTypes)) return;

    oreCache.clear();

    // Iterate over all configured ore types
    for (const oreTypeKey in xrayConfig.monitoredOreTypes) {
        const oreType = xrayConfig.monitoredOreTypes[oreTypeKey];
        if (!isDefined(oreType) || oreType.enabled !== true) continue;

        // Iterate over blocks defined for this ore type
        for (const blockDef of oreType.blocks) {
            if (!oreCache.has(blockDef.blockId)) {
                oreCache.set(blockDef.blockId, []);
            }

            const cacheEntry = oreCache.get(blockDef.blockId);
            if (isDefined(cacheEntry)) {
                cacheEntry.push({
                    oreType: oreType,
                    minY: blockDef.minY,
                    maxY: blockDef.maxY,
                    dimensionId: blockDef.dimensionId
                });
            }
        }
    }
}

function sendAlert(player: mc.Player, oreType: MonitoredOreType, location: mc.Vector3, count: number): void {
    const xrayConfig = getXrayConfig();
    if (!isDefined(xrayConfig)) return;

    const context = {
        playerName: player.name,
        oreName: oreType.oreName,
        count: count,
        x: location.x.toFixed(2),
        y: location.y.toFixed(2),
        z: location.z.toFixed(2)
    };

    const message = formatString('§7{playerName}§r mined §e{count} {oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r', context);

    if (xrayConfig.notifications.logToConsole === true) {
        warnLog(`[X-Ray] ${message.replaceAll(/§./g, '')}`);
    }

    const onlinePlayers = getAllPlayersFromCache();
    for (const onlinePlayer of onlinePlayers) {
        const pData = getOrCreatePlayer(onlinePlayer);

        if (isDefined(pData) && hasPermission(onlinePlayer, 'group.mod') && pData.xrayNotificationsEnabled === true) {
            try {
                onlinePlayer.sendMessage(message);
            } catch (error) {
                warnLog(`Failed to send X-Ray alert to ${onlinePlayer.name}: ${String(error)}`);
            }
        }
    }
}

function flushAlert(playerId: string, oreKey: string): void {
    const playerBuffer = alertBuffers.get(playerId);
    if (!isDefined(playerBuffer)) return;
    const data = playerBuffer.get(oreKey);
    if (!isDefined(data)) return;

    playerBuffer.delete(oreKey);
    if (playerBuffer.size === 0) {
        alertBuffers.delete(playerId);
    }

    const player = getPlayerFromCache(playerId);
    if (isDefined(player)) {
        sendAlert(player, data.oreType, data.blockLocation, data.count);
    }
}

function bufferAlert(player: mc.Player, oreType: MonitoredOreType, block: mc.Block): void {
    const xrayConfig = getXrayConfig();
    const bufferTime = ((isDefined(xrayConfig) ? xrayConfig.notifications.alertBufferingSeconds : undefined) ?? 0) * 20;

    if (bufferTime <= 0) {
        sendAlert(player, oreType, block.location, 1);
        return;
    }

    const playerBuffer = alertBuffers.get(player.id) ?? new Map<string, AlertData>();
    if (!alertBuffers.has(player.id)) {
        alertBuffers.set(player.id, playerBuffer);
    }

    const oreKey = oreType.oreName;
    const existingData = playerBuffer.get(oreKey);

    if (isDefined(existingData)) {
        existingData.count++;
        existingData.blockLocation = { ...block.location };
    } else {
        const timerId = setTrackedTimeout(() => {
            flushAlert(player.id, oreKey);
        }, bufferTime);
        playerBuffer.set(oreKey, {
            count: 1,
            timerId,
            blockLocation: { ...block.location },
            oreType
        });
    }
}

function handleBlockBreak(event: mc.PlayerBreakBlockAfterEvent): void {
    const { player, brokenBlockPermutation, block } = event;
    if (!isDefined(block)) return;

    // Fast Config & Cache Check
    const blockId = brokenBlockPermutation.type.id;
    const cachedInfos = oreCache.get(blockId);

    // 1. Optimization: O(1) Check if this block is even monitored
    if (!isDefined(cachedInfos)) return;

    const xrayConfig = getXrayConfig();
    const settings = xrayConfig.settings;

    // 2. Gamemode Checks
    const gamemode = player.getGameMode();
    if (settings.ignoreCreative === true && gamemode === mc.GameMode.Creative) return;
    if (settings.ignoreSpectator === true && gamemode === mc.GameMode.Spectator) return;

    // 3. Admin Bypass Check
    if (settings.adminBypass === true) {
        const pData = getPlayer(player.id);

        if (isDefined(pData) && hasPermission(player, 'group.admin')) return;
    }

    // 4. Validate Location & Dimension (O(N) where N is small, usually 1 or 2 entries per block)
    const dimensionId = player.dimension.id;
    const y = block.location.y;

    for (const info of cachedInfos) {
        if (info.dimensionId === dimensionId && y >= info.minY && y <= info.maxY) {
            bufferAlert(player, info.oreType, block);
            return; // Found a match, no need to check other definitions for the same block
        }
    }
}

export function initializeXrayDetection(): void {
    refreshXrayCache(); // Build initial cache
    registerEvent(mc.world.afterEvents.playerBreakBlock, handleBlockBreak, 'xrayDetection');
}
