import { world, system, Player, EntityDamageCause } from '@minecraft/server';
import { getSpawnConfig } from '../../core/configurations.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayerRank } from '../../core/rankManager.js';
import { errorLog } from '../../core/errorLogger.js';

// State variables to hold subscription handles and timer IDs for cleanup
let eventHandlers = [];
let intervalId = -1;

/**
 * Unsubscribes all event handlers and clears timers to allow for re-initialization.
 */
function cleanup() {
    for (const { event, handler } of eventHandlers) {
        try {
            event.unsubscribe(handler);
        } catch (e) {
            // This might happen if the script reloads and the handler reference is lost.
            // We log it but don't crash, as the goal is to clean up what we can.
            errorLog(`[SpawnProtection] Failed to unsubscribe from an event: ${e.message}`);
        }
    }
    eventHandlers = []; // Reset for the next initialization

    if (intervalId !== -1) {
        system.clearRun(intervalId);
        intervalId = -1;
    }
}

/**
 * A wrapper for subscribing to events that tracks them for later cleanup.
 * @param {any} event The event signal object (e.g., world.beforeEvents.playerBreakBlock)
 * @param {Function} handler The function to subscribe.
 */
function subscribe(event, handler) {
    // Guard against subscribing to events that might not exist in the current API version.
    if (!event) {
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
    if (!location || !dimensionId) {return false;}

    const spawnConfig = getSpawnConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;
    const spawnLocation = spawnConfig?.spawn?.spawnLocation;

    if (!spawnProtectionConfig?.enabled || !spawnLocation?.dimensionId) {
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
 * @param {Player | undefined} player The player to check.
 * @returns {boolean} True if the player can bypass protection.
 */
function canBypass(player) {
    if (!(player instanceof Player)) {return false;}

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
    // Always run cleanup first to remove any existing listeners before re-applying them.
    // This makes the function safely re-runnable.
    cleanup();

    const spawnConfig = getSpawnConfig();
    if (!spawnConfig) {
        errorLog('[SpawnProtection] Could not load spawn configuration.');
        return;
    }

    const { spawn, spawnProtection } = spawnConfig;

    // Guard 1: Check if the spawnProtection config section exists and is enabled.
    if (!spawnProtection?.enabled) {
        // Protection is not configured or is disabled. This is a normal state, so we exit silently.
        return;
    }

    const spawnLocation = spawn?.spawnLocation;

    // Guard 2: If enabled, check if a spawn point has been set.
    if (!spawnLocation) {
        // This is an actionable error. Protection is on, but can't function without a location.
        errorLog('[SpawnProtection] Spawn protection is enabled, but no spawn location is set. Protection will not be active until /setspawn is used.');
        return;
    }

    // --- EVENT-BASED PROTECTIONS ---

    if (spawnProtection.preventBlockBreaking) {
        subscribe(world.beforeEvents.playerBreakBlock, (event) => {
            if (!event.player) {return;}
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventBlockPlacing) {
        subscribe(world.beforeEvents.playerPlaceBlock, (event) => {
            if (!event.player) {return;}
            // Corrected: The dimension ID is on event.block.dimension for this event type.
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventExplosions) {
        subscribe(world.beforeEvents.explosion, (event) => {
            if (event.dimension.id !== spawnLocation.dimensionId) {return;}
            const finalImpactedBlocks = event.getImpactedBlocks().filter(block =>
                // Corrected: Use the block's dimension, not the event's.
                !isWithinSpawnProtection(block.location, block.dimension.id)
            );
            event.setImpactedBlocks(finalImpactedBlocks);
        });
    }

    if (spawnProtection.preventBlockInteraction) {
        subscribe(world.beforeEvents.playerInteractWithBlock, (event) => {
            if (!event.player) {return;}
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventFire) {
        subscribe(world.beforeEvents.itemUseOn, (event) => {
            if (!(event.source instanceof Player) || !event.block) {return;}
            const item = event.itemStack;
            if (item.typeId === 'minecraft:flint_and_steel' || item.typeId === 'minecraft:fire_charge') {
                if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventPvP || spawnProtection.preventPvE) {
        subscribe(world.beforeEvents.entityHurt, (event) => {
            if (!event.hurtEntity?.dimension) {return;}
            if (!isWithinSpawnProtection(event.hurtEntity.location, event.hurtEntity.dimension.id)) {return;}

            const { hurtEntity, damageSource } = event;

            // PvP Protection
            if (spawnProtection.preventPvP && hurtEntity instanceof Player && damageSource.damagingEntity instanceof Player) {
                if (!canBypass(damageSource.damagingEntity)) {event.cancel = true;}
                return;
            }

            // PvE Protection (Player Immortality)
            if (spawnProtection.preventPvE && hurtEntity instanceof Player) {
                const bypassCauses = [EntityDamageCause.void, EntityDamageCause.suicide];
                if (!bypassCauses.includes(damageSource.cause)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventItemDropping) {
        subscribe(world.beforeEvents.itemDrop, (event) => {
            if (event.source instanceof Player) {
                if (isWithinSpawnProtection(event.source.location, event.source.dimension.id) && !canBypass(event.source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventItemPickup) {
        subscribe(world.beforeEvents.itemPickup, (event) => {
            // Corrected: The entity picking up the item is event.entity, not event.player
            const player = event.entity;
            if (player instanceof Player) {
                if (isWithinSpawnProtection(event.item.location, event.item.dimension.id) && !canBypass(player)) {
                    event.cancel = true;
                }
            }
        });
    }

    // --- INTERVAL-BASED PROTECTIONS ---

    intervalId = system.runInterval(() => {
        const currentSpawnConfig = getSpawnConfig();
        const protection = currentSpawnConfig?.spawnProtection;
        const loc = currentSpawnConfig?.spawn?.spawnLocation;

        if (!protection?.enabled || !loc) {return;}

        for (const player of world.getAllPlayers()) {
            if (!isWithinSpawnProtection(player.location, player.dimension.id)) {continue;}

            // Hunger Loss Prevention
            if (protection.preventHungerLoss) {
                player.getComponent('minecraft:food')?.resetToDefaultValue();
            }
        }

        // Mob Spawning Prevention (Cleanup Routine)
        if (protection.preventMobSpawning) {
            // Guard against running this with a null spawn location, which causes a native crash.
            if (typeof loc.x !== 'number' || typeof loc.y !== 'number' || typeof loc.z !== 'number') {
                return;
            }
            try {
                const entitiesInSpawn = world.getDimension(loc.dimensionId).getEntities({
                    location: loc,
                    maxDistance: protection.protectionRadius,
                    families: ['monster'], // Specifically target hostile mobs
                    excludeFamilies: ['player', 'inanimate']
                });

                for (const entity of entitiesInSpawn) {
                    if (isWithinSpawnProtection(entity.location, entity.dimension.id)) {
                        entity.kill();
                    }
                }
            } catch (e) {
                errorLog(`[SpawnProtection] Error during mob cleanup: ${e}`);
            }
        }
    }, 40); // Run every 2 seconds
}

export { initialize as initializeSpawnProtection };