import * as mc from '@minecraft/server';

import { getXrayConfig } from '../../../core/configurations.js';
import { jobManager } from '../../../core/jobManager.js';
import { warnLog } from '../../../core/logger.js';
import { getAllPlayersFromCache } from '../../../core/playerCache.js';
import { getOrCreatePlayer } from '../../../core/playerDataManager.js';

// Metadata tag to identify bait blocks
// We can't tag blocks directly. We must use DynamicProperties.
// const BAIT_PROPERTY = 'xray:is_bait';

function isBait(block: mc.Block): boolean {
    // Check dynamic property on the dimension at that location?
    // No, block dynamic properties aren't a thing yet in stable, only Entity/World/Item.
    // Wait, 1.21 might have it?
    // If not, we use the Chunk-based approach like Obfuscator.
    // Key: xray:bait:x,y,z

    // Optimization: To avoid 1000s of keys, we should clean them up.
    // Let's use the exact same strategy as Obfuscator: Chunk Data.
    // But since Bait is rare, maybe just a global Map in memory + World Dynamic Property for persistence?

    // For now, let's use a simpler approach:
    // If a player breaks a diamond ore that was surrounded by stone... wait, that's normal generation.
    // Bait is *placed* by us.

    // Let's use a "Bait Database" stored in World Dynamic Properties.
    // Since there will only be a few active baits at a time (per player), this is fine.

    const key = `bait:${block.location.x},${block.location.y},${block.location.z}`;
    const val = mc.world.getDynamicProperty(key);
    return val === true;
}

function setBait(block: mc.Block, state: boolean) {
    const key = `bait:${block.location.x},${block.location.y},${block.location.z}`;
    mc.world.setDynamicProperty(key, state ? true : undefined);
}

function notifyBaitTrigger(player: mc.Player, oreType: string) {
     const xrayConfig = getXrayConfig();
     const requiredLevel = xrayConfig?.notifications?.alertPermissionLevel ?? 2;

     const msg = `§c§l[X-RAY TRAP]§r §e${player.name}§c mined a FAUX ${oreType}! High certainty alert.`;
     warnLog(msg);

     // Notify admins
     const players = getAllPlayersFromCache();
     for (const p of players) {
         const pData = getOrCreatePlayer(p);
         if (pData && pData.permissionLevel <= requiredLevel) {
             p.playSound('note.pling');
             p.sendMessage(msg);
         }
     }
}

/**
 * Periodically places bait ores near mining players.
 */
function scheduleBaitPlacement() {
    mc.system.runInterval(() => {
        const xrayConfig = getXrayConfig();
        if (!xrayConfig?.heuristics?.baitOres) return;

        for (const player of mc.world.getAllPlayers()) {
            if (player.location.y > 50) continue;

            // 10% chance per check to place bait
            if (Math.random() > 0.1) continue;

            jobManager.addJob({
                id: `bait:${player.name}`,
                priority: 2,
                work: () => placeBaitNear(player)
            });
        }
    }, 200); // Every 10 seconds
}

function placeBaitNear(player: mc.Player) {
    const dim = player.dimension;
    const head = player.getHeadLocation();

    // Find a spot inside a wall
    // Random direction
    const dir = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10 };
    const target = {
        x: Math.floor(head.x + dir.x),
        y: Math.floor(head.y + dir.y),
        z: Math.floor(head.z + dir.z)
    };

    const block = dim.getBlock(target);
    if (!block) return;

    // Must be solid stone/deepslate
    if (block.typeId !== 'minecraft:stone' && block.typeId !== 'minecraft:deepslate') return;

    // Must be completely surrounded by solids (don't expose it to air)
    // We want them to X-Ray to find it.
    // Reuse isCompletelyHidden logic or similar
    // Simple check:
    const neighbor = dim.getBlock({x: target.x, y: target.y + 1, z: target.z});
    if (!neighbor || neighbor.isAir) return; // Exposed top

    // Place Bait!
    const baitType = Math.random() > 0.5 ? 'minecraft:diamond_ore' : 'minecraft:gold_ore';

    // Store original block to restore later? No, it was stone. We don't care.
    // Actually, we should clean it up if they move away.

    block.setType(baitType);
    setBait(block, true);

    // Schedule cleanup
    mc.system.runTimeout(() => {
        // Check if it's still bait (wasn't mined)
        try {
            const b = dim.getBlock(target);
            if (b && isBait(b)) {
                b.setType('minecraft:stone'); // Restore to stone
                setBait(b, false);
            }
        } catch {
            // Chunk unloaded or invalid
        }
    }, 1200); // 1 minute later
}

function handleBlockBreak(event: mc.PlayerBreakBlockAfterEvent) {
    const { block, player } = event;

    if (isBait(block)) {
        // CAUGHT!
        notifyBaitTrigger(player, block.typeId);

        // Remove bait tag
        setBait(block, false);

        // No drops?
        // We can't cancel drops in AfterEvent.
        // We must use BeforeEvent to cancel drops, OR just kill the item entity.
        // Since we are in AfterEvent here for consistency, we'll try to find the item entity.

        const dim = block.dimension;
        const center = block.center();
        const items = dim.getEntities({
            location: center,
            maxDistance: 2,
            type: 'minecraft:item'
        });

        for (const item of items) {
             // Heuristic: It just spawned. Kill it.
             // item.kill(); // Error: kill does not exist on Entity in Beta? remove()
             try {
                 item.remove();
             } catch {
                 // Entity might already be gone
             }
        }
    }
}

export function initializeBaitSystem() {
    mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
    scheduleBaitPlacement();
}
