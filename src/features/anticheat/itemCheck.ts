import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';

import { getAnticheatConfig } from './anticheatConfigLoader.js';
import { flag } from './flagManager.js';

export function startItemCheckLoop() {
    mc.system.runInterval(() => {
        try {
            const config = getAnticheatConfig();
            if (!config.enabled || !config.itemCheck.enabled) return;

            for (const player of mc.world.getAllPlayers()) {
                if (player.isValid) {
                    checkInventory(player, config.itemCheck);
                }
            }
        } catch (e) {
            errorLog('Anticheat Item Loop Error', e);
        }
    }, 100); // Check every 5 seconds
}

interface ItemCheckConfig {
    bannedItems: string[];
    maxEnchantLevel: number;
    illegalEnchantments?: boolean;
    removeIllegalItems?: boolean;
}

function checkInventory(player: mc.Player, config: ItemCheckConfig) {
    if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) return;

    const inventory = player.getComponent('minecraft:inventory') as mc.EntityInventoryComponent;
    if (!inventory || !inventory.container) return;

    const container = inventory.container;
    const bannedItems = config.bannedItems;
    const MAX_ENCHANT_LEVEL = config.maxEnchantLevel || 5;

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) {
            // Check for over-stacked items
            if (item.amount > item.maxAmount) {
                flag(player, 'itemCheck', `Illegal Stack: ${item.typeId} x${item.amount} (Max: ${item.maxAmount})`);
                if (config.removeIllegalItems) {
                    // Set amount to max allowed or remove?
                    // Safe approach: Clamp to max
                    item.amount = item.maxAmount;
                    container.setItem(i, item);
                }
            }

            // Check illegal enchants
            const enchantable = item.getComponent('minecraft:enchantable') as mc.ItemEnchantableComponent;
            if (enchantable && enchantable.getEnchantments) {
                // getEnchantments() returns readonly array in newer versions
                const enchants = enchantable.getEnchantments();
                for (const enchant of enchants) {
                    if (enchant.level > MAX_ENCHANT_LEVEL && config.illegalEnchantments) {
                        flag(
                            player,
                            'itemCheck',
                            `Illegal Enchant: ${enchant.type.id} Level ${enchant.level} (Max: ${MAX_ENCHANT_LEVEL})`
                        );
                        if (config.removeIllegalItems) {
                            container.setItem(i); // Remove item
                            // Break loop for this item since it's gone
                            break;
                        }
                    }
                }
            }

            // Check banned items
            // If item was removed by enchant check, item is null/undefined now? No, we need to check existence if we continue logic.
            // But we used 'break' above.
            // However, we should check `item` typeId again if we didn't break.
            // Actually, best to check existence again or use continue.

            // Re-fetch item to be safe or just check if we removed it
            const currentItem = container.getItem(i);
            if (!currentItem) continue;

            if (bannedItems.includes(currentItem.typeId)) {
                flag(player, 'itemCheck', `Banned Item: ${currentItem.typeId}`);
                if (config.removeIllegalItems) {
                    container.setItem(i);
                }
            }
        }
    }
}
