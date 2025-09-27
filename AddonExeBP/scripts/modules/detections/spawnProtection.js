import { world, system, Player } from '@minecraft/server';
import { getSpawnConfig } from '../../core/configurations.js';
import { getConfig } from '../../core/configManager.js';
import { getPlayerRank } from '../../core/rankManager.js';

/**
 * Checks if a location is within the protected spawn area.
 * @param {import('@minecraft/server').Vector3} location The location to check.
 * @param {string} dimensionId The dimension of the location.
 * @returns {boolean} True if the location is within the protected area, false otherwise.
 */
function isWithinSpawnProtection(location, dimensionId) {
    const spawnConfig = getSpawnConfig();
    const spawnProtectionConfig = spawnConfig.spawnProtection;
    const spawnLocation = spawnConfig.spawn ? spawnConfig.spawn.spawnLocation : null;

    // Highly defensive check to prevent crashes
    if (
        !spawnProtectionConfig ||
        !spawnProtectionConfig.enabled ||
        !spawnLocation ||
        typeof spawnLocation.x !== 'number' ||
        typeof spawnLocation.z !== 'number' ||
        typeof spawnLocation.dimensionId !== 'string'
    ) {
        return false;
    }

    if (dimensionId !== spawnLocation.dimensionId) {
        return false;
    }

    const dx = location.x - spawnLocation.x;
    const dz = location.z - spawnLocation.z;
    const distanceSquared = dx * dx + dz * dz;

    return distanceSquared <= spawnProtectionConfig.protectionRadius * spawnProtectionConfig.protectionRadius;
}

/**
 * Checks if a player can bypass spawn protection.
 * @param {Player} player The player to check.
 * @returns {boolean} True if the player can bypass protection, false otherwise.
 */
function canBypass(player) {
    const spawnConfig = getSpawnConfig();
    const config = getConfig();
    const spawnProtectionConfig = spawnConfig.spawnProtection;

    if (!spawnProtectionConfig || !spawnProtectionConfig.allowAdminBypass) {
        return false;
    }
    const playerRank = getPlayerRank(player, config);
    // Permission level 1 or lower is considered admin/owner
    return playerRank.permissionLevel <= 1;
}

function initialize() {
    const spawnConfig = getSpawnConfig();
    const spawnProtectionConfig = spawnConfig.spawnProtection;
    const spawnLocation = spawnConfig.spawn ? spawnConfig.spawn.spawnLocation : null;

    // Add a robust check to ensure the config section is a valid object before proceeding
    if (!spawnProtectionConfig || typeof spawnProtectionConfig !== 'object' || !spawnProtectionConfig.enabled || !spawnLocation) {
        return;
    }

    if (spawnProtectionConfig.preventBlockBreaking) {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventBlockPlacing) {
        world.beforeEvents.playerPlaceBlock.subscribe((event) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventExplosions) {
        world.beforeEvents.explosion.subscribe((event) => {
            const spawnDimension = getSpawnConfig().spawn.spawnLocation?.dimensionId;
            if (!spawnDimension || event.dimension.id !== spawnDimension) {return;}

            const initialImpactedBlocks = event.getImpactedBlocks();
            const protectedBlocks = initialImpactedBlocks.filter(block => isWithinSpawnProtection(block.location, event.dimension.id));

            if (protectedBlocks.length > 0) {
                const finalImpactedBlocks = initialImpactedBlocks.filter(block => !protectedBlocks.includes(block));
                event.setImpactedBlocks(finalImpactedBlocks);
            }
        });
    }

    if (spawnProtectionConfig.preventBlockInteraction) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventFire) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            const { source, itemStack, block } = event;
            if (!(source instanceof Player) || !block) {return;}

            if (itemStack.typeId === 'minecraft:flint_and_steel' || itemStack.typeId === 'minecraft:lava_bucket') {
                if (isWithinSpawnProtection(block.location, block.dimension.id) && !canBypass(source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtectionConfig.preventPvP || spawnProtectionConfig.preventPvE) {
        world.beforeEvents.entityHurt.subscribe((event) => {
            const { hurtEntity, damageSource } = event;
            const damagingEntity = damageSource.damagingEntity;

            // Add a guard to ensure the hurt entity and its dimension are valid
            if (!hurtEntity?.dimension) {return;}

            if (!isWithinSpawnProtection(hurtEntity.location, hurtEntity.dimension.id)) {return;}

            // PvP Protection
            if (spawnProtectionConfig.preventPvP && hurtEntity instanceof Player && damagingEntity instanceof Player && !canBypass(damagingEntity)) {
                event.cancel = true;
                return;
            }

            // PvE Protection (Player getting hurt by non-player)
            if (spawnProtectionConfig.preventPvE && hurtEntity instanceof Player && damagingEntity && !(damagingEntity instanceof Player)) {
                event.cancel = true;
                return;
            }
        });
    }

    if (spawnProtectionConfig.preventMobSpawning) {
        world.beforeEvents.mobSpawn.subscribe((event) => {
            if (isWithinSpawnProtection(event.location, event.dimension.id)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventItemDropping) {
        world.beforeEvents.itemDrop.subscribe((event) => {
            const { source } = event;
            if (!(source instanceof Player)) {return;}

            if (isWithinSpawnProtection(source.location, source.dimension.id) && !canBypass(source)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventItemPickup) {
        world.beforeEvents.itemPickup.subscribe((event) => {
            if (isWithinSpawnProtection(event.item.location, event.item.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }


    if (spawnProtectionConfig.preventHungerLoss) {
        system.runInterval(() => {
            for (const player of world.getAllPlayers()) {
                if (isWithinSpawnProtection(player.location, player.dimension.id)) {
                    player.getComponent('minecraft:food').resetToDefaultValue();
                }
            }
        }, 20); // Run every second
    }
}

export { initialize as initializeSpawnProtection };