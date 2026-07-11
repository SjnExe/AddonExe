import { getConfig } from '@core/configManager.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { getProtectionFlags } from '@core/protectionService.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

function canBypass(player: mc.Player): boolean {
    // Check if admin bypass is allowed globally or in spawn configuration
    const config = getConfig();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (config && config.spawnProtection && !config.spawnProtection.allowAdminBypass) {
        return false;
    }

    try {
        const pData = getOrCreatePlayer(player);
        // Owner(0), Admin(1), Mod(2) bypass
        return pData.permissionLevel <= 2;
    } catch {
        return false;
    }
}

export function handleBeforePlayerBreakBlock(event: mc.PlayerBreakBlockBeforeEvent) {
    const { player, block } = event;
    if (!isDefined(player) || !isDefined(block)) return;

    const flags = getProtectionFlags(block.location, player.dimension.id);
    if (flags.preventBlockBreaking) {
        if (!canBypass(player)) {
            event.cancel = true;
            mc.system.run(() => {
                player.onScreenDisplay.setActionBar('§cYou cannot break blocks here.');
            });
        }
    }
}

export function handleBeforePlayerPlaceBlock(event: mc.PlayerPlaceBlockBeforeEvent) {
    const { player, block } = event;
    if (!isDefined(player) || !isDefined(block)) return;

    const flags = getProtectionFlags(block.location, player.dimension.id);
    if (flags.preventBlockPlacing) {
        if (!canBypass(player)) {
            event.cancel = true;
            mc.system.run(() => {
                player.onScreenDisplay.setActionBar('§cYou cannot place blocks here.');
            });
        }
    }
}

export function handleBeforeExplosion(event: mc.ExplosionBeforeEvent) {
    // If explosion is prevented at the source, cancel it entirely
    const blocks = event.getImpactedBlocks();
    const loc = event.source?.location ?? (blocks.length > 0 ? blocks[0]!.location : undefined);
    if (!loc) return;
    const flags = getProtectionFlags(loc, event.dimension.id);

    // Prevent Mob Griefing logic (Creepers, Withers)
    if (flags.preventMobGriefing && event.source && event.source.typeId !== MinecraftEntityTypes.Player) {
        // Prevent block damage from mob explosions
        event.setImpactedBlocks([]);
        return;
    }

    // As a fallback/more precise method, we could filter impacted blocks,
    // but beforeExplosion lets us cancel or modify impacted blocks.
    if (flags.preventExplosions) {
        event.cancel = true;
        return;
    }

    // Filter out blocks that are in protected areas from being destroyed
    const impactedBlocks = event.getImpactedBlocks();
    const allowedBlocks: mc.Block[] = [];
    for (const block of impactedBlocks) {
        if (!isDefined(block)) continue;
        const blockFlags = getProtectionFlags(block.location, event.dimension.id);
        if (!blockFlags.preventExplosions && (!blockFlags.preventMobGriefing || !event.source || event.source.typeId === MinecraftEntityTypes.Player)) {
            allowedBlocks.push(block);
        }
    }
    event.setImpactedBlocks(allowedBlocks);
}

export function handleBeforeItemUse(event: mc.ItemUseBeforeEvent) {
    const player = event.source;
    if (!(player instanceof mc.Player)) return;

    const flags = getProtectionFlags(player.location, player.dimension.id);
    if (flags.preventProjectileUsage) {
        // Basic list of items that shoot projectiles
        const projectileItems = [
            MinecraftItemTypes.Bow,
            MinecraftItemTypes.Crossbow,
            MinecraftItemTypes.Snowball,
            MinecraftItemTypes.EnderPearl,
            MinecraftItemTypes.Egg,
            MinecraftItemTypes.SplashPotion,
            MinecraftItemTypes.LingeringPotion,
            MinecraftItemTypes.ExperienceBottle,
            MinecraftItemTypes.Trident
        ];

        if (projectileItems.includes(event.itemStack.typeId as MinecraftItemTypes)) {
            if (!canBypass(player)) {
                event.cancel = true;
                mc.system.run(() => {
                    player.onScreenDisplay.setActionBar('§cYou cannot use projectiles here.');
                });
            }
        }
    }
}

export function handlePlayerInteractWithBlock(event: mc.PlayerInteractWithBlockBeforeEvent) {
    const { player, block } = event;
    if (!isDefined(player) || !isDefined(block)) return;

    const flags = getProtectionFlags(block.location, player.dimension.id);
    if (flags.preventBlockInteraction) {
        if (!canBypass(player)) {
            event.cancel = true;
            mc.system.run(() => {
                player.onScreenDisplay.setActionBar('§cYou cannot interact with blocks here.');
            });
        }
    }
}

export function handlePlayerInteractWithEntity(event: mc.PlayerInteractWithEntityBeforeEvent) {
    const { player, target } = event;
    if (!isDefined(player) || !isDefined(target)) return;

    const flags = getProtectionFlags(target.location, target.dimension.id);

    if (flags.preventEntityInteraction) {
        // We only want to prevent interaction with entities that are NOT meant to be ridden/pets
        // Let's allow interaction with players, tameables (wolves, cats, parrots),
        // rideables (horses, donkeys, mules, pigs with saddle, striders)

        if (target.typeId !== MinecraftEntityTypes.Player) {
            // Allow interactions if it can be tamed or ridden (pets/mounts)
            // eslint-disable-next-line no-restricted-syntax
            const canRide = target.hasComponent('minecraft:rideable');
            // eslint-disable-next-line no-restricted-syntax
            const canTame = target.hasComponent('minecraft:tameable');
            // eslint-disable-next-line no-restricted-syntax
            const isTamed = target.hasComponent('minecraft:is_tamed'); // already tamed

            if (!canRide && !canTame && !isTamed) {
                if (!canBypass(player)) {
                    event.cancel = true;
                    mc.system.run(() => {
                        player.onScreenDisplay.setActionBar('§cYou cannot interact with entities here.');
                    });
                }
            }
        }
    }
}

export function handleBeforeItemPickup(event: mc.EntityItemPickupBeforeEvent) {
    const entity = event.entity;
    if (entity.typeId !== MinecraftEntityTypes.Player) return;
    const player = entity as mc.Player;

    const flags = getProtectionFlags(player.location, player.dimension.id);
    if (flags.preventItemPickup) {
        if (!canBypass(player)) {
            event.cancel = true;
            mc.system.run(() => {
                player.onScreenDisplay.setActionBar('§cYou cannot pick up items here.');
            });
        }
    }
}

export function handleBeforeEntitySpawn(event: mc.EntitySpawnAfterEvent) {
    const { entity } = event;
    if (!isDefined(entity)) return;
    try {
        const isValid = entity.isValid;
        if (!isValid) return;

        // If hostile spawning is prevented
        if (entity.typeId !== MinecraftEntityTypes.Player) {
            // eslint-disable-next-line no-restricted-syntax
            const familyTypes = entity.getComponent('minecraft:type_family');
            if (familyTypes?.hasTypeFamily('monster')) {
                const flags = getProtectionFlags(entity.location, entity.dimension.id);
                if (flags.preventHostileMobSpawning) {
                    // Cannot cancel afterEvent, so we despawn
                    mc.system.run(() => {
                        try {
                            const isStillValid = entity.isValid;
                            if (isStillValid) {
                                entity.remove();
                            }
                        } catch {
                            // ignore
                        }
                    });
                }
            }
        }
    } catch {
        // Ignore InvalidEntityError
    }
}

export function handleBeforeEntityHurt(event: mc.EntityHurtBeforeEvent) {
    const { damageSource } = event;
    const victim = event.hurtEntity;

    const flags = getProtectionFlags(victim.location, victim.dimension.id);
    const cause = damageSource.cause;

    // Fall damage protection (All entities)
    if (flags.preventFallDamage && cause === mc.EntityDamageCause.fall) {
        event.cancel = true;
        return;
    }

    // Magic damage protection (All entities)
    if (flags.preventMagicDamage && (cause === mc.EntityDamageCause.magic || cause === mc.EntityDamageCause.wither)) {
        event.cancel = true;
        return;
    }

    if (victim.typeId !== MinecraftEntityTypes.Player) return;

    const player = victim as mc.Player;

    if (!flags.preventPvP && !flags.preventHostileDamage) return;

    const damagingEntity = damageSource.damagingEntity;

    // Helper to get actual attacker (e.g., owner of projectile)
    // eslint-disable-next-line no-restricted-syntax
    const projectileComponent = damagingEntity?.getComponent('minecraft:projectile');
    const attacker = projectileComponent?.owner ?? damagingEntity;

    // PvP Protection
    if (flags.preventPvP) {
        if (attacker && attacker.typeId === MinecraftEntityTypes.Player && attacker.id !== player.id) {
            event.cancel = true;
            return;
        }
    }

    // Hostile Damage Protection
    if (flags.preventHostileDamage) {
        // Direct damage from non-player entities
        if (attacker && attacker.typeId !== MinecraftEntityTypes.Player) {
            // eslint-disable-next-line no-restricted-syntax
            const familyTypes = attacker.getComponent('minecraft:type_family');
            if (familyTypes?.hasTypeFamily('monster') || familyTypes?.hasTypeFamily('mob')) {
                event.cancel = true;
                return;
            } else if (!familyTypes?.hasTypeFamily('inanimate') && !familyTypes?.hasTypeFamily('player')) {
                event.cancel = true;
                return;
            }
        }
    }
}
