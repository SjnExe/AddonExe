import { getSpawnConfig } from '@core/configurations.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { getProtectionFlags } from '@core/protectionService.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

function canBypass(player: mc.Player): boolean {
    // Check if admin bypass is allowed globally or in spawn configuration
    const config = getSpawnConfig();
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
        if (!blockFlags.preventExplosions) {
            allowedBlocks.push(block);
        }
    }
    event.setImpactedBlocks(allowedBlocks);
}

export function handleBeforeItemUse(event: mc.ItemUseBeforeEvent) {
    const player = event.source;
    if (!(player instanceof mc.Player)) return;

    // We can't definitively check block from itemUse directly in all versions easily,
    // so we will rely on playerInteractWithBlock. We'll leave this empty or remove it.
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

    // Entity interaction shouldn't usually trigger block interaction preventions,
    // but armor stands and item frames might be considered blocks depending on usage.
    // If desired, add custom flags for entities. For now, we skip.
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleBeforeItemDrop(event: any) {
    // Handling depends on the actual event structure. It's either itemDrop or playerDropItem
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const p = event.source || event.player;
    if (!isDefined(p)) return;
    const player = p as mc.Player;

    const flags = getProtectionFlags(player.location, player.dimension.id);
    if (flags.preventItemDropping) {
        if (!canBypass(player)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            event.cancel = true;
            mc.system.run(() => {
                player.onScreenDisplay.setActionBar('§cYou cannot drop items here.');
            });
        }
    }
}

export function handleBeforeItemPickup(event: mc.EntityItemPickupBeforeEvent) {
    const entity = event.entity;
    if (entity.typeId !== 'minecraft:player') return;
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
        if (entity.typeId !== 'minecraft:player') {
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
