import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getSpawnConfig } from '@core/configurations.js';
import { debugLog, errorLog, infoLog } from '@core/logger.js';
import { getPlayerRank } from '@core/rankManager.js';

interface TrackedEvent {
    event: mc.PlayerBreakBlockBeforeEventSignal | mc.PlayerPlaceBlockAfterEventSignal;
    handler: (event: mc.PlayerBreakBlockBeforeEvent | mc.PlayerPlaceBlockAfterEvent) => void;
}

let eventHandlers: TrackedEvent[] = [];
let intervalId: number | undefined;

function cleanup(): void {
    debugLog('[SpawnProtection] Cleaning up old event handlers and timers...');
    for (const { event, handler } of eventHandlers) {
        try {
            event.unsubscribe(handler);
        } catch (e: unknown) {
            errorLog(`[SpawnProtection] Failed to unsubscribe from an event: ${String(e)}`);
        }
    }
    eventHandlers = [];

    if (intervalId !== undefined) {
        mc.system.clearRun(intervalId);
        intervalId = undefined;
        debugLog('[SpawnProtection] Interval cleared.');
    }

    debugLog('[SpawnProtection] Forcefully removing protection effects from all online players.');
    for (const player of mc.world.getAllPlayers()) {
        player.removeTag('inSpawn');
        player.triggerEvent('exe:remove_spawn_protection');
        player.triggerEvent('exe:enable_pvp');
        player.triggerEvent('exe:enable_hostile_damage');
    }
}

function subscribe(
    event: mc.PlayerBreakBlockBeforeEventSignal | mc.PlayerPlaceBlockAfterEventSignal,
    handler: (event: mc.PlayerBreakBlockBeforeEvent | mc.PlayerPlaceBlockAfterEvent) => void
): void {
    if (!event) {
        debugLog('[SpawnProtection] Attempted to subscribe to a non-existent event.');
        return;
    }
    event.subscribe(handler);
    eventHandlers.push({ event, handler });
}

function isWithinSpawnProtection(location: mc.Vector3, dimensionId: string): boolean {
    const spawnConfig = getSpawnConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;
    const spawnLocation = spawnConfig?.spawn?.spawnLocation;

    if (
        !spawnProtectionConfig?.enabled ||
        !spawnLocation?.dimensionId ||
        typeof spawnLocation.x !== 'number' ||
        typeof spawnLocation.y !== 'number' ||
        typeof spawnLocation.z !== 'number'
    ) {
        return false;
    }

    if (dimensionId !== spawnLocation.dimensionId) {
        return false;
    }

    const dx = location.x - spawnLocation.x;
    const dz = location.z - spawnLocation.z;
    const distanceSquared = dx * dx + dz * dz;
    const radiusSquared = spawnProtectionConfig.protectionRadius * spawnProtectionConfig.protectionRadius;

    return distanceSquared <= radiusSquared;
}

function canBypass(player: mc.Player): boolean {
    const spawnConfig = getSpawnConfig();
    const mainConfig = getConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;

    if (!spawnProtectionConfig?.allowAdminBypass) {
        return false;
    }
    const playerRank = getPlayerRank(player, mainConfig);
    return playerRank.permissionLevel <= 1;
}

function initialize(): void {
    infoLog('[SpawnProtection] Initializing...');
    cleanup();

    const spawnConfig = getSpawnConfig();
    const { spawn, spawnProtection } = spawnConfig ?? {};

    if (!spawnProtection?.enabled) {
        infoLog('[SpawnProtection] Protection is disabled in the config.');
        return;
    }

    const spawnLocation = spawn?.spawnLocation;
    if (!spawnLocation || typeof spawnLocation.x !== 'number') {
        errorLog('[SpawnProtection] Spawn protection is enabled, but no spawn location is set.');
        return;
    }

    infoLog(`[SpawnProtection] Protection ENABLED. Radius: ${spawnProtection.protectionRadius}`);

    if (spawnProtection.preventBlockBreaking) {
        subscribe(
            mc.world.beforeEvents.playerBreakBlock,
            (event: mc.PlayerBreakBlockBeforeEvent | mc.PlayerPlaceBlockAfterEvent) => {
                if (
                    'block' in event &&
                    isWithinSpawnProtection(event.block.location, event.block.dimension.id) &&
                    !canBypass(event.player)
                ) {
                    if ('cancel' in event) {
                        event.cancel = true;
                    }
                }
            }
        );
    }

    if (spawnProtection.preventBlockPlacing) {
        subscribe(mc.world.afterEvents.playerPlaceBlock, (event: mc.PlayerPlaceBlockAfterEvent) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.block.setType('minecraft:air');
            }
        });
    }

    // Additional event subscriptions would go here...

    intervalId = mc.system.runInterval(() => {
        const currentSpawnConfig = getSpawnConfig();
        const protection = currentSpawnConfig?.spawnProtection;
        const loc = currentSpawnConfig?.spawn?.spawnLocation;

        if (!protection?.enabled || !loc || typeof loc.x !== 'number') return;

        // Interval logic for mob spawning and player effects
        for (const player of mc.world.getAllPlayers()) {
            const wasInSpawn = player.hasTag('inSpawn');
            const isInSpawn = isWithinSpawnProtection(player.location, player.dimension.id);

            if (isInSpawn && !wasInSpawn) {
                player.addTag('inSpawn');
                if (canBypass(player)) continue;

                if (protection.preventItemPickup || protection.preventItemDropping)
                    player.triggerEvent('exe:apply_spawn_protection');
                if (protection.preventPvP) player.triggerEvent('exe:disable_pvp');
                if (protection.preventHostileDamage) player.triggerEvent('exe:disable_hostile_damage');
            } else if (!isInSpawn && wasInSpawn) {
                player.removeTag('inSpawn');
                player.triggerEvent('exe:remove_spawn_protection');
                player.triggerEvent('exe:enable_pvp');
                player.triggerEvent('exe:enable_hostile_damage');
            }
        }
    }, 40);
}

export { initialize as initializeSpawnProtection };
