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
            const player = event.source;
            if (!(player instanceof Player) || !event.block) {return;}

            const item = event.itemStack;
            const fireStarters = ['minecraft:flint_and_steel', 'minecraft:fire_charge', 'minecraft:lava_bucket'];

            if (fireStarters.includes(item?.typeId) && isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventPvP || spawnProtection.preventPvE) {
        subscribe(world.beforeEvents.entityHurt, (event) => {
            const { hurtEntity, damageSource } = event;

            // We only care about players being hurt in spawn
            if (!(hurtEntity instanceof Player) || !hurtEntity.dimension) { return; }
            if (!isWithinSpawnProtection(hurtEntity.location, hurtEntity.dimension.id)) { return; }

            // Admins with bypass are immune to spawn protection rules
            if (canBypass(hurtEntity)) { return; }

            const attacker = damageSource.damagingEntity;

            // Handle PvP: A player is hurting another player
            if (attacker instanceof Player && spawnProtection.preventPvP) {
                // If the attacker is an admin, let them attack. Otherwise, cancel.
                if (!canBypass(attacker)) {
                    event.cancel = true;
                }
                return; // PvP handled, no need for PvE check on the same event
            }

            // Handle PvE: Damage from mobs or environment to a player
            if (spawnProtection.preventPvE) {
                const pveBypassCauses = [
                    EntityDamageCause.void,
                    EntityDamageCause.suicide,
                    EntityDamageCause.entityAttack // Re-check to ensure we didn't miss a PvP case
                ];

                // If damage is from another player, PvP rules should have already caught it.
                // But as a fallback, if PvP is OFF but PvE is ON, this will still protect players from each other.
                if (damageSource.cause === 'entityAttack' && attacker instanceof Player) {
                    if (spawnProtection.preventPvP && !canBypass(attacker)) {
                        event.cancel = true;
                    }
                    return;
                }

                // Protect from all other non-bypassable damage sources
                if (!pveBypassCauses.includes(damageSource.cause)) {
                    event.cancel = true;
                }
            }
        });
    }


    if (spawnProtection.preventItemDropping) {
        subscribe(world.beforeEvents.itemDrop, (event) => {
            const player = event.source;
            if (player instanceof Player) {
                if (isWithinSpawnProtection(player.location, player.dimension.id) && !canBypass(player)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventItemPickup) {
        subscribe(world.beforeEvents.itemPickup, (event) => {
            const player = event.entity;
            if (player instanceof Player) {
                // Check protection at the item's location, not the player's
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

        // Guard against running with a null spawn location, which can cause native crashes.
        if (typeof loc.x !== 'number' || typeof loc.y !== 'number' || typeof loc.z !== 'number') {
            return;
        }

        for (const player of world.getAllPlayers()) {
            if (!isWithinSpawnProtection(player.location, player.dimension.id) || canBypass(player)) {continue;}

            // Hunger Loss Prevention
            if (protection.preventHungerLoss) {
                // Using setFood is more direct than resetToDefaultValue
                player.getComponent('minecraft:food')?.setFoodLevel(20);
            }
        }

        // Mob Spawning Prevention (Cleanup Routine)
        if (protection.preventMobSpawning) {
            try {
                const entitiesInSpawn = world.getDimension(loc.dimensionId).getEntities({
                    location: loc,
                    maxDistance: protection.protectionRadius,
                    families: ['monster'], // Specifically target hostile mobs
                    excludeFamilies: ['player', 'inanimate']
                });

                for (const entity of entitiesInSpawn) {
                    // Double-check the entity is still in spawn before removing
                    if (isWithinSpawnProtection(entity.location, entity.dimension.id)) {
                        // Teleport mobs to the void to remove them without loot drops
                        entity.teleport({ x: entity.location.x, y: -128, z: entity.location.z });
                    }
                }
            } catch (e) {
                errorLog(`[SpawnProtection] Error during mob cleanup: ${e}`);
            }
        }
    }, 40); // Run every 2 seconds
}

export { initialize as initializeSpawnProtection };