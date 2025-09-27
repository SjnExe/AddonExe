import { world, system, Player, EntityDamageCause } from '@minecraft/server';
import { getSpawnConfig } from '../../core/configurations.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayerRank } from '../../core/rankManager.js';
import { errorLog } from '../../core/errorLogger.js';

/**
 * Checks if a location is within the protected spawn area.
 * @param {import('@minecraft/server').Vector3 | undefined} location The location to check.
 * @param {string | undefined} dimensionId The dimension of the location.
 * @returns {boolean} True if the location is within the protected area.
 */
function isWithinSpawnProtection(location, dimensionId) {
    if (!location || !dimensionId) return false;

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
    if (!(player instanceof Player)) return false;

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
    const spawnConfig = getSpawnConfig();
    if (!spawnConfig) {
        errorLog('[SpawnProtection] Could not load spawn configuration.', new Error());
        return;
    }

    const { spawn, spawnProtection } = spawnConfig;
    const spawnLocation = spawn?.spawnLocation;

    if (!spawnProtection?.enabled || !spawnLocation) {
        // This is the main guard. If protection is off or spawn isn't set, do nothing.
        return;
    }

    // --- EVENT-BASED PROTECTIONS ---

    if (spawnProtection.preventBlockBreaking) {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (!event.player) return;
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventBlockPlacing) {
        world.beforeEvents.playerPlaceBlock.subscribe((event) => {
            if (!event.player) return;
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventExplosions) {
        world.beforeEvents.explosion.subscribe((event) => {
            if (event.dimension.id !== spawnLocation.dimensionId) return;
            const finalImpactedBlocks = event.getImpactedBlocks().filter(block =>
                !isWithinSpawnProtection(block.location, event.dimension.id)
            );
            event.setImpactedBlocks(finalImpactedBlocks);
        });
    }

    if (spawnProtection.preventBlockInteraction) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
            if (!event.player) return;
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventFire) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            if (!(event.source instanceof Player) || !event.block) return;
            const item = event.itemStack;
            if (item.typeId === 'minecraft:flint_and_steel' || item.typeId === 'minecraft:fire_charge') {
                if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventPvP || spawnProtection.preventPvE) {
        world.beforeEvents.entityHurt.subscribe((event) => {
            if (!event.hurtEntity?.dimension) return;
            if (!isWithinSpawnProtection(event.hurtEntity.location, event.hurtEntity.dimension.id)) return;

            const { hurtEntity, damageSource } = event;

            // PvP Protection
            if (spawnProtection.preventPvP && hurtEntity instanceof Player && damageSource.damagingEntity instanceof Player) {
                if (!canBypass(damageSource.damagingEntity)) event.cancel = true;
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
        world.beforeEvents.itemDrop.subscribe((event) => {
            if (event.source instanceof Player) {
                if (isWithinSpawnProtection(event.source.location, event.source.dimension.id) && !canBypass(event.source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventItemPickup) {
        world.beforeEvents.itemPickup.subscribe((event) => {
            // Check if the entity picking up the item is a player
            if (event.player) {
                 if (isWithinSpawnProtection(event.item.location, event.item.dimension.id) && !canBypass(event.player)) {
                    event.cancel = true;
                }
            }
        });
    }

    // --- INTERVAL-BASED PROTECTIONS ---

    system.runInterval(() => {
        const currentSpawnConfig = getSpawnConfig();
        const protection = currentSpawnConfig?.spawnProtection;
        const loc = currentSpawnConfig?.spawn?.spawnLocation;

        if (!protection?.enabled || !loc) return;

        for (const player of world.getAllPlayers()) {
            if (!isWithinSpawnProtection(player.location, player.dimension.id)) continue;

            // Hunger Loss Prevention
            if (protection.preventHungerLoss) {
                player.getComponent('minecraft:food')?.resetToDefaultValue();
            }
        }

        // Mob Spawning Prevention (Cleanup Routine)
        if (protection.preventMobSpawning) {
            try {
                const entitiesInSpawn = world.getDimension(loc.dimensionId).getEntities({
                    location: loc,
                    maxDistance: protection.protectionRadius,
                    families: ["monster"], // Specifically target hostile mobs
                    excludeFamilies: ["player", "inanimate"],
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