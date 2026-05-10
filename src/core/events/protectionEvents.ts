import * as mc from '@minecraft/server';
import { getProtectionFlags } from '@core/protectionService.js';
import { isDefined } from '@lib/guards.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';

function canBypass(player: mc.Player): boolean {
    // Currently, admin bypass logic is not centrally configured across all features in main config,
    // but typically Owners/Admins (level <= 1) are treated as staff. We will just check permissions.
    try {
        const pData = getOrCreatePlayer(player);
        return pData.permissionLevel <= 2; // Owner(0), Admin(1), Mod(2) bypass
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
            player.onScreenDisplay.setActionBar('§cYou cannot break blocks here.');
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
            player.onScreenDisplay.setActionBar('§cYou cannot place blocks here.');
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

export function handleBeforeItemUseOn(event: unknown) {
    const ev = event as mc.ItemUseBeforeEvent; // Fallback cast
    const player = ev.source;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const block = (ev as any).block as mc.Block | undefined;
    if (!(player instanceof mc.Player)) return;
    if (!isDefined(block)) return;

    const flags = getProtectionFlags(block.location, player.dimension.id);
    if (flags.preventBlockInteraction) {
        if (!canBypass(player)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (event as any).cancel = true;
            player.onScreenDisplay.setActionBar('§cYou cannot interact with blocks here.');
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
            player.onScreenDisplay.setActionBar('§cYou cannot interact with blocks here.');
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

export function handleBeforeEntitySpawn(event: mc.EntitySpawnAfterEvent) {
    const { entity } = event;
    if (!isDefined(entity)) return;

    // If hostile spawning is prevented
    if (entity.typeId !== 'minecraft:player') {
        const familyTypes = entity.getComponent('minecraft:type_family');
        if (familyTypes?.hasTypeFamily('monster')) {
            const flags = getProtectionFlags(entity.location, entity.dimension.id);
            if (flags.preventHostileMobSpawning) {
                // Cannot cancel afterEvent, so we despawn
                mc.system.run(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    const isValid = typeof (entity as any).isValid === 'function' ? (entity as any).isValid() : (entity as any).isValid;
                    if (isValid) {
                        entity.remove();
                    }
                });
            }
        }
    }
}