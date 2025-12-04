import * as mc from '@minecraft/server';
import { getAnticheatConfig } from './anticheatConfigLoader.js';
import { debugLog } from '../../core/logger.js';

/**
 * Checks a player's inventory for illegal items.
 * @param player The player to check.
 */
export function checkInventory(player: mc.Player) {
    const config = getAnticheatConfig();
    if (!config.enabled || !config.itemCheck.enabled) return;

    const inventory = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!inventory || !inventory.container) return;

    const container = inventory.container;
    const bannedItems = new Set(config.itemCheck.bannedItems);

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item) continue;

        let illegal = false;
        let reason = '';

        // Check banned items
        if (bannedItems.has(item.typeId)) {
            illegal = true;
            reason = 'Banned Item';
        }

        // Check enchantments
        if (!illegal && config.itemCheck.illegalEnchantments) {
             const enchantable = item.getComponent('minecraft:enchantable');
             if (enchantable) {
                 // Casting to any to access enchantments if type definition is outdated
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 const enchants = (enchantable as any).getEnchantments ? (enchantable as any).getEnchantments() : [];
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 for (const enchant of enchants as any[]) {
                     if (enchant.level > 5) { // Threshold: 5 is vanilla max for most. 10 is safe "modded but ok".
                         // But sharpness goes up to 5.
                         // Let's set 10 as hard limit for now.
                         if (enchant.level > 10) {
                             illegal = true;
                             reason = `Illegal Enchantment Level: ${enchant.level}`;
                             break;
                         }
                     }
                 }
             }
        }

        if (illegal) {
            if (config.itemCheck.removeIllegalItems) {
                container.setItem(i, undefined);
                player.sendMessage(`§cRemoved illegal item: ${item.typeId} (${reason})`);
                debugLog(`[AntiCheat] Removed ${item.typeId} from ${player.name}. Reason: ${reason}`);
            }
        }
    }
}

export function startItemCheckLoop() {
    mc.system.runInterval(() => {
        for (const player of mc.world.getAllPlayers()) {
            checkInventory(player);
        }
    }, 100); // Check every 5 seconds
}
