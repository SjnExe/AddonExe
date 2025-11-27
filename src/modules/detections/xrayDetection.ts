import * as mc from '@minecraft/server';

import { getXrayConfig } from '../../core/configurations.js';
import { warnLog } from '../../core/logger.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '../../core/playerCache.js';
import { getOrCreatePlayer } from '../../core/playerDataManager.js';
import { formatString } from '../../core/utils.js';
import { MonitoredOreType } from '../../core/xrayConfig.default.js';

interface AlertData {
    count: number;
    timerId: number;
    blockLocation: mc.Vector3;
    oreType: MonitoredOreType;
}

const alertBuffers = new Map<string, Map<string, AlertData>>();

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
        warnLog(message);
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

    const blockId = brokenBlockPermutation.type.id;
    const dimensionId = player.dimension.id;

    const xrayConfig = getXrayConfig();
    if (!xrayConfig?.monitoredOreTypes) return;

    for (const oreTypeKey in xrayConfig.monitoredOreTypes) {
        const oreType = (xrayConfig.monitoredOreTypes as Record<string, MonitoredOreType>)[oreTypeKey];
        if (!oreType.enabled) continue;

        const monitoredBlock = oreType.blocks.find((b: { blockId: string }) => b.blockId === blockId);
        if (!monitoredBlock) continue;

        if (monitoredBlock.dimensionId !== dimensionId) continue;
        if (block.location.y < monitoredBlock.minY || block.location.y > monitoredBlock.maxY) continue;

        bufferAlert(player, oreType, block);
        return;
    }
}

export function initializeXrayDetection(): void {
    mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
}
