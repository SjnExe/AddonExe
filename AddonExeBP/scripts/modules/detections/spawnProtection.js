import * as mc from '@minecraft/server';
import { getSpawnConfig } from '../../core/configurations.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayerRank } from '../../core/rankManager.js';
import { errorLog, infoLog, debugLog } from '../../core/logger.js';

// State variables to hold subscription handles and timer IDs for cleanup
let eventHandlers = [];
let intervalId = -1;

/**
 * Unsubscribes all event handlers and clears timers to allow for re-initialization.
 */
function cleanup() {
    debugLog('[SpawnProtection] Cleaning up old event handlers and timers...');
    for (const { event, handler } of eventHandlers) {
        try {
            event.unsubscribe(handler);
        } catch (e) {
            errorLog(`[SpawnProtection] Failed to unsubscribe from an event: ${e.message}`);
        }
    }
    eventHandlers = [];

    if (intervalId !== -1) {
        mc.system.clearRun(intervalId);
        intervalId = -1;
        debugLog('[SpawnProtection] Interval cleared.');
    }

    // Forcefully remove protection effects from all players to ensure a clean state on re-initialization.
    debugLog('[SpawnProtection] Forcefully removing protection effects from all online players.');
    for (const player of mc.world.getAllPlayers()) {
        player.removeTag('inSpawn');
        // Run commands to remove all possible protection component groups
        player.runCommand('event entity @s exe:remove_spawn_protection');
        player.runCommand('event entity @s exe:enable_pvp');
        player.runCommand('event entity @s exe:enable_hostile_damage');
    }
}

/**
 * A wrapper for subscribing to events that tracks them for later cleanup.
 * @param {any} event The event signal object (e.g., world.beforeEvents.playerBreakBlock)
 * @param {Function} handler The function to subscribe.
 */
function subscribe(event, handler) {
    if (!event) {
        debugLog('[SpawnProtection] Attempted to subscribe to a non-existent event.');
        return;
    }
    event.subscribe(handler);
    eventHandlers.push({ event, handler });
}

/**
 * Checks if a location is within the protected spawn area.
 * @param {import('@minecraft/server').Vector3 | undefined} location The location to check.
 * @param {string | undefined} dimensionId The dimension of the location.
 * @returns {boolean} True if the location is within the protected area.
 */
function isWithinSpawnProtection(location, dimensionId) {
    if (!location || !dimensionId) { return false; }

    const spawnConfig = getSpawnConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;
    const spawnLocation = spawnConfig?.spawn?.spawnLocation;

    if (!spawnProtectionConfig?.enabled ||
        !spawnLocation?.dimensionId ||
        typeof spawnLocation.x !== 'number' ||
        typeof spawnLocation.y !== 'number' ||
        typeof spawnLocation.z !== 'number') {
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

/**
 * Checks if a player can bypass spawn protection.
 * @param {mc.Player | undefined} player The player to check.
 * @returns {boolean} True if the player can bypass protection.
 */
function canBypass(player) {
    if (!(player instanceof mc.Player)) { return false; }

    const spawnConfig = getSpawnConfig();
    const mainConfig = getConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;

    if (!spawnProtectionConfig?.allowAdminBypass) {
        return false;
    }
    const playerRank = getPlayerRank(player, mainConfig);
    return playerRank.permissionLevel <= 1; // Admin or Owner
}

/**
 * Registers all spawn protection event listeners based on the current config.
 */
function initialize() {
    infoLog('[SpawnProtection] Initializing...');
    cleanup();

    const spawnConfig = getSpawnConfig();
    if (!spawnConfig) {
        errorLog('[SpawnProtection] Could not load spawn configuration.');
        return;
    }

    const { spawn, spawnProtection } = spawnConfig;

    if (!spawnProtection?.enabled) {
        infoLog('[SpawnProtection] Protection is disabled in the config. Exiting initialization.');
        return;
    }

    const spawnLocation = spawn?.spawnLocation;

    if (!spawnLocation || typeof spawnLocation.x !== 'number') {
        errorLog('[SpawnProtection] Spawn protection is enabled, but no spawn location is set. Protection will not be active until /setspawn is used.');
        return;
    }

    infoLog(`[SpawnProtection] Protection ENABLED. Radius: ${spawnProtection.protectionRadius}, Location: ${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z}`);

    // --- EVENT-BASED PROTECTIONS ---
    if (spawnProtection.preventBlockBreaking) {
        debugLog('[SpawnProtection] Subscribing to block break events.');
        subscribe(mc.world.beforeEvents.playerBreakBlock, (event) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventBlockPlacing) {
        debugLog('[SpawnProtection] Subscribing to block place events.');
        subscribe(mc.world.beforeEvents.playerPlaceBlock, (event) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventExplosions) {
        debugLog('[SpawnProtection] Subscribing to explosion events.');
        subscribe(mc.world.beforeEvents.explosion, (event) => {
            if (event.dimension.id !== spawnLocation.dimensionId) { return; }
            const finalImpactedBlocks = event.getImpactedBlocks().filter(block =>
                !isWithinSpawnProtection(block.location, block.dimension.id)
            );
            event.setImpactedBlocks(finalImpactedBlocks);
        });
    }

    if (spawnProtection.preventBlockInteraction) {
        debugLog('[SpawnProtection] Subscribing to block interaction events.');
        subscribe(mc.world.beforeEvents.playerInteractWithBlock, (event) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    // --- INTERVAL-BASED PROTECTIONS ---
    debugLog('[SpawnProtection] Starting protection interval...');
    intervalId = mc.system.runInterval(() => {
        const currentSpawnConfig = getSpawnConfig();
        const protection = currentSpawnConfig?.spawnProtection;
        const loc = currentSpawnConfig?.spawn?.spawnLocation;

        if (!protection?.enabled || !loc || typeof loc.x !== 'number') {
            return;
        }

        if (protection.preventHostileMobSpawning) {
            try {
                const entitiesInSpawn = mc.world.getDimension(loc.dimensionId).getEntities({
                    location: loc,
                    maxDistance: protection.protectionRadius,
                    families: ['monster'],
                    excludeFamilies: ['player', 'inanimate']
                });

                for (const entity of entitiesInSpawn) {
                    if (isWithinSpawnProtection(entity.location, entity.dimension.id)) {
                        entity.remove();
                    }
                }
            } catch (e) {
                errorLog(`[SpawnProtection] Error during mob cleanup: ${e}`);
            }
        }

        for (const player of mc.world.getAllPlayers()) {
            const wasInSpawn = player.hasTag('inSpawn');
            const isInSpawn = isWithinSpawnProtection(player.location, player.dimension.id);
            const playerName = player.name;

            if (isInSpawn && !wasInSpawn) {
                debugLog(`[SpawnProtection] Player '${playerName}' ENTERED spawn area.`);
                player.addTag('inSpawn');
                if (canBypass(player)) {
                    debugLog(`[SpawnProtection] Player '${playerName}' can bypass. No effects applied.`);
                    continue;
                }

                if (protection.preventItemPickup || protection.preventItemDropping) {
                    debugLog(`[SpawnProtection] Applying item protection to '${playerName}'.`);
                    player.runCommand('event entity @s exe:apply_spawn_protection');
                }
                if (protection.preventPvP) {
                    debugLog(`[SpawnProtection] Disabling PvP for '${playerName}'.`);
                    player.runCommand('event entity @s exe:disable_pvp');
                }
                if (protection.preventHostileDamage) {
                    debugLog(`[SpawnProtection] Disabling hostile damage for '${playerName}'.`);
                    player.runCommand('event entity @s exe:disable_hostile_damage');
                }

            } else if (!isInSpawn && wasInSpawn) {
                debugLog(`[SpawnProtection] Player '${playerName}' EXITED spawn area.`);
                player.removeTag('inSpawn');
                debugLog(`[SpawnProtection] Removing all protections from '${playerName}'.`);
                player.runCommand('event entity @s exe:remove_spawn_protection');
                player.runCommand('event entity @s exe:enable_pvp');
                player.runCommand('event entity @s exe:enable_hostile_damage');
            }
        }
    }, 40);
}

export { initialize as initializeSpawnProtection };