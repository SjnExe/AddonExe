import * as mc from '@minecraft/server';

import { getXrayConfig } from '@core/configurations.js';
import { warnLog } from '@core/logger.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer } from '@core/playerDataManager.js';
import { formatString } from '@core/utils.js';
import { MonitoredOreType } from '@core/xrayConfig.default.js';

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
    if (!xrayConfig?.monitoredOreTypes) return;

    oreCache.clear();

    // Iterate over all configured ore types
    for (const oreTypeKey in xrayConfig.monitoredOreTypes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oreType = (xrayConfig.monitoredOreTypes as any)[oreTypeKey] as MonitoredOreType;
        if (!oreType.enabled) continue;

        // Iterate over blocks defined for this ore type
        for (const blockDef of oreType.blocks) {
            if (!oreCache.has(blockDef.blockId)) {
                oreCache.set(blockDef.blockId, []);
            }

            oreCache.get(blockDef.blockId)!.push({
                oreType: oreType,
                minY: blockDef.minY,
                maxY: blockDef.maxY,
                dimensionId: blockDef.dimensionId
            });
        }
    }
}

function sendAlert(player: mc.Player, oreType: MonitoredOreType, location: mc.Vector3, count: number): void {
    const xrayConfig = getXrayConfig();
    if (!xrayConfig) return;

    const context = {
        playerName: player.name,
        oreName: oreType.oreName,
        count: count,
        x: location.x.toFixed(2),
        y: location.y.toFixed(2),
        z: location.z.toFixed(2)
    };

    const message = formatString('§7{playerName}§r mined §e{count} {oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r', context);

    if (xrayConfig.notifications.logToConsole) {
        // eslint-disable-next-line no-console
        console.warn(`[X-Ray] ${message.replace(/§./g, '')}`);
    }

    const onlinePlayers = getAllPlayersFromCache();
    for (const onlinePlayer of onlinePlayers) {
        const pData = getOrCreatePlayer(onlinePlayer);
        const requiredLevel = xrayConfig.notifications.alertPermissionLevel ?? 2;

        if (pData && pData.permissionLevel <= requiredLevel && pData.xrayNotificationsEnabled) {
            try {
                onlinePlayer.sendMessage(message);
            } catch (e) {
                warnLog(`Failed to send X-Ray alert to ${onlinePlayer.name}: ${e}`);
            }
        }
    }
}

function flushAlert(playerId: string, oreKey: string): void {
    const playerBuffer = alertBuffers.get(playerId);
    if (!playerBuffer) return;
    const data = playerBuffer.get(oreKey);
    if (!data) return;

    playerBuffer.delete(oreKey);
    if (playerBuffer.size === 0) {
        alertBuffers.delete(playerId);
    }

    const player = getPlayerFromCache(playerId);
    if (player) {
        sendAlert(player, data.oreType, data.blockLocation, data.count);
    }
}

function bufferAlert(player: mc.Player, oreType: MonitoredOreType, block: mc.Block): void {
    const xrayConfig = getXrayConfig();
    const bufferTime = (xrayConfig?.notifications.alertBufferingSeconds ?? 0) * 20;

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

    if (existingData) {
        existingData.count++;
        existingData.blockLocation = { ...block.location };
    } else {
        const timerId = mc.system.runTimeout(() => {
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
    if (!block) return;

    // Fast Config & Cache Check
    const blockId = brokenBlockPermutation.type.id;
    const cachedInfos = oreCache.get(blockId);

    // 1. Optimization: O(1) Check if this block is even monitored
    if (!cachedInfos) return;

    const xrayConfig = getXrayConfig();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (xrayConfig as any).settings || {};

    // 2. Gamemode Checks
    const gamemode = player.getGameMode();
    if (settings.ignoreCreative && gamemode === mc.GameMode.Creative) return;
    if (settings.ignoreSpectator && gamemode === mc.GameMode.Spectator) return;

    // 3. Admin Bypass Check
    if (settings.adminBypass) {
        const pData = getPlayer(player.id);
        const bypassLevel = settings.bypassPermissionLevel ?? 1;
        if (pData && pData.permissionLevel <= bypassLevel) return;
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
    mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
