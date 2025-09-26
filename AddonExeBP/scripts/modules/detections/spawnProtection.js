import { world, system, Player } from '@minecraft/server';
import { getConfig } from '../../core/configManager.js';
import { getPlayerRank } from '../../core/rankManager.js';

/**
 * Checks if a location is within the protected spawn area.
 * @param {import('@minecraft/server').Vector3} location The location to check.
 * @param {string} dimensionId The dimension of the location.
 * @returns {boolean} True if the location is within the protected area, false otherwise.
 */
function isWithinSpawnProtection(location, dimensionId) {
    const config = getConfig();
    const spawnProtectionConfig = config.spawnProtection;
    const spawnLocation = config.spawnLocation;

    if (!spawnProtectionConfig.enabled || !spawnLocation) {
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
    const config = getConfig();
    if (!config.spawnProtection.allowAdminBypass) {
        return false;
    }
    const playerRank = getPlayerRank(player, config);
    // Permission level 1 or lower is considered admin/owner
    return playerRank.permissionLevel <= 1;
}

function initialize() {
    const config = getConfig();
    // Guard against migration issues where the new section might not exist on old configs
    const spawnProtectionConfig = config.spawnProtection || { enabled: false };

    if (!spawnProtectionConfig.enabled) {
        return;
    }

    if (spawnProtectionConfig.preventBlockBreaking) {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventBlockPlacing) {
        world.beforeEvents.playerPlaceBlock.subscribe((event) => {
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventExplosions) {
        world.beforeEvents.explosion.subscribe((event) => {
            const spawnDimension = getConfig().spawnLocation?.dimensionId;
            if (!spawnDimension || event.dimension.id !== spawnDimension) return;

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
            if (isWithinSpawnProtection(event.block.location, event.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtectionConfig.preventFire) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            const { source, itemStack } = event;
            if (!(source instanceof Player)) return;

            if (itemStack.typeId === 'minecraft:flint_and_steel' || itemStack.typeId === 'minecraft:lava_bucket') {
                if (isWithinSpawnProtection(event.block.location, source.dimension.id) && !canBypass(source)) {
                    event.cancel = true;
                }
            }
        });
    }

    if (spawnProtectionConfig.preventPvP || spawnProtectionConfig.preventPvE) {
        world.beforeEvents.entityHurt.subscribe((event) => {
            const { hurtEntity, damageSource } = event;
            const damagingEntity = damageSource.damagingEntity;

            if (!isWithinSpawnProtection(hurtEntity.location, hurtEntity.dimension.id)) return;

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
            if (!(source instanceof Player)) return;

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