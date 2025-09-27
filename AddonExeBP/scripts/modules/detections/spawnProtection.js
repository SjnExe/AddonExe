import { world, system, Player, EntityDamageCause } from '@minecraft/server';
import { getSpawnConfig } from '../../core/configurations.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayerRank } from '../../core/rankManager.js';
import { errorLog } from '../../core/errorLogger.js';

/**
 * Checks if a location is within the protected spawn area (a cylinder).
 * @param {import('@minecraft/server').Vector3} location The location to check.
 * @param {string} dimensionId The dimension of the location.
 * @returns {boolean} True if the location is within the protected area, false otherwise.
 */
function isWithinSpawnProtection(location, dimensionId) {
    const spawnConfig = getSpawnConfig();
    // These checks are defensive, assuming config might be malformed.
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
 * @param {Player} player The player to check.
 * @returns {boolean} True if the player can bypass protection, false otherwise.
 */
function canBypass(player) {
    const spawnConfig = getSpawnConfig();
    const mainConfig = getConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;

    if (!spawnProtectionConfig?.allowAdminBypass) {
        return false;
    }
    const playerRank = getPlayerRank(player, mainConfig);
    // Permission level 1 or lower is considered admin/owner
    return playerRank.permissionLevel <= 1;
}

/**
 * Registers all spawn protection event listeners based on the current config.
 */
function initialize() {
    const spawnConfig = getSpawnConfig();
    if (!spawnConfig) {
        errorLog('[SpawnProtection] Could not load spawn configuration. Aborting initialization.');
        return;
    }

    const { spawn, spawnProtection } = spawnConfig;
    const spawnLocation = spawn?.spawnLocation;

    // Main guard: If protection is disabled or spawn isn't set, do nothing.
    if (!spawnProtection?.enabled || !spawnLocation) {
        return;
    }

    // --- Event-based Protections ---

    if (spawnProtection.preventBlockBreaking) {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventBlockPlacing) {
        world.beforeEvents.playerPlaceBlock.subscribe((event) => {
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
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventFire) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            const { source, itemStack, block } = event;
            if (!(source instanceof Player) || !block) return;

            if (itemStack.typeId === 'minecraft:flint_and_steel' || itemStack.typeId === 'minecraft:fire_charge') {
                if (isWithinSpawnProtection(block.location, block.dimension.id) && !canBypass(source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventPvP || spawnProtection.preventPvE) {
        world.beforeEvents.entityHurt.subscribe((event) => {
            const { hurtEntity, damageSource } = event;
            if (!hurtEntity.dimension || !isWithinSpawnProtection(hurtEntity.location, hurtEntity.dimension.id)) {
                return;
            }

            // Player vs Player
            if (spawnProtection.preventPvP && hurtEntity instanceof Player && damageSource.damagingEntity instanceof Player) {
                if (!canBypass(damageSource.damagingEntity)) {
                    event.cancel = true;
                }
                return;
            }

            // Player vs Environment (Immortality)
            if (spawnProtection.preventPvE && hurtEntity instanceof Player) {
                // Allow specific damage causes to bypass protection
                const bypassCauses = [EntityDamageCause.void, EntityDamageCause.suicide];
                if (!bypassCauses.includes(damageSource.cause)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtection.preventItemDropping) {
        world.beforeEvents.itemDrop.subscribe((event) => {
            if (event.source instanceof Player && isWithinSpawnProtection(event.source.location, event.source.dimension.id) && !canBypass(event.source)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventItemPickup) {
        world.beforeEvents.itemPickup.subscribe((event) => {
            if (isWithinSpawnProtection(event.item.location, event.item.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    // --- Interval-based Protections ---

    if (spawnProtection.preventHungerLoss) {
        system.runInterval(() => {
            for (const player of world.getAllPlayers()) {
                if (isWithinSpawnProtection(player.location, player.dimension.id)) {
                    // Resetting food ticks prevents hunger loss
                    player.getComponent('minecraft:food')?.resetToDefaultValue();
                }
            }
        }, 20); // Every second
    }

    if (spawnProtection.preventMobSpawning) {
        // This is a backup for mobs that might get into spawn via other means (e.g. pushed, teleported)
        system.runInterval(() => {
            const entitiesInSpawn = world.getDimension(spawnLocation.dimensionId).getEntities({
                location: spawnLocation,
                maxDistance: spawnProtection.protectionRadius,
                excludeFamilies: ['player', 'item', 'armor_stand'],
                excludeTypes: ['minecraft:xp_orb']
            });

            for (const entity of entitiesInSpawn) {
                // Simple check for hostility: has health and is not tamed.
                // This will also catch neutral mobs like wolves or iron golems.
                const health = entity.getComponent('minecraft:health');
                const tamed = entity.getComponent('minecraft:is_tamed');
                if (health && !tamed) {
                    if(isWithinSpawnProtection(entity.location, entity.dimension.id)) {
                       entity.kill();
                    }
                }
            }
        }, 100); // Every 5 seconds
    }
}

export { initialize as initializeSpawnProtection };