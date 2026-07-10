import { setTrackedInterval } from "@core/timerManager.js";
import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { isDefined } from '@lib/guards.js';

import { AnticheatConfig, getAnticheatConfig } from '@features/anticheat/configLoader.js';
import { flag } from '@features/anticheat/flagManager.js';

let isChecking = false;

export function startItemCheckLoop() {
    setTrackedInterval(() => {
        if (isChecking) return;
        try {
            const config = getAnticheatConfig();
            if (config.enabled !== true || config.itemCheck.enabled !== true) return;

            mc.system.runJob(checkInventoryGenerator(config));
        } catch (error) {
            errorLog('Anticheat Item Loop Error', error);
        }
    }, 100); // Check every 5 seconds
}

function* checkInventoryGenerator(config: AnticheatConfig) {
    isChecking = true;
    try {
        // Optimization: Use cached players
        const players = getAllPlayersFromCache();
        for (const player of players) {
            if (player.isValid) {
                checkPlayerInventory(player, config.itemCheck);
            }
            yield;
        }
    } catch (error) {
        errorLog('Anticheat Item Job Error', error);
    } finally {
        isChecking = false;
    }
}

interface ItemCheckConfig {
    bannedItems: string[];
    maxEnchantLevel: number;
    illegalEnchantments?: boolean;
    removeIllegalItems?: boolean;
}

export function checkPlayerInventory(player: mc.Player, config: ItemCheckConfig) {
    if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) return;

    // Check Main Inventory
    const inventory = player.getComponent('minecraft:inventory') as mc.EntityInventoryComponent;
    if (isDefined(inventory) && isDefined(inventory.container)) {
        const container = inventory.container;
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (isDefined(item)) {
                checkItem(item, player, config, (newItem) => container.setItem(i, newItem));
            }
        }
    }

    // Check Equipment (Armor + Offhand)
    const equippable = player.getComponent('minecraft:equippable') as mc.EntityEquippableComponent;
    if (isDefined(equippable)) {
        const slots = [mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet, mc.EquipmentSlot.Offhand];

        for (const slot of slots) {
            const item = equippable.getEquipment(slot);
            if (isDefined(item)) {
                checkItem(item, player, config, (newItem) => equippable.setEquipment(slot, newItem));
            }
        }
    }
}

export function checkItem(item: mc.ItemStack, player: mc.Player, config: ItemCheckConfig, updateItem: (item?: mc.ItemStack) => void) {
    const bannedItems = config.bannedItems;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const MAX_ENCHANT_LEVEL = config.maxEnchantLevel ?? 5;
    let modified = false;

    // Check Stack Size
    if (item.amount > item.maxAmount) {
        flag(player, 'itemCheck', `Illegal Stack: ${item.typeId} x${item.amount} (Max: ${item.maxAmount})`);
        if (config.removeIllegalItems === true) {
            item.amount = item.maxAmount;
            modified = true;
        }
    }

    // Check Enchants
    const enchantable = item.getComponent('minecraft:enchantable') as mc.ItemEnchantableComponent;
    if (isDefined(enchantable) && 'getEnchantments' in enchantable) {
        // getEnchantments() returns readonly array
        const enchants = enchantable.getEnchantments();
        for (const enchant of enchants) {
            const vanillaMax = enchant.type.maxLevel;
            // Allow whichever is higher: Config limit or Vanilla limit.
            const allowed = Math.max(MAX_ENCHANT_LEVEL, vanillaMax);

            if (enchant.level > allowed && config.illegalEnchantments === true) {
                flag(player, 'itemCheck', `Illegal Enchant: ${enchant.type.id} Level ${enchant.level} (Max: ${allowed})`);
                if (config.removeIllegalItems === true) {
                    updateItem(); // Remove item
                    return; // Stop checking this item
                }
            }
        }
    }

    // Check Banned ID
    if (bannedItems.includes(item.typeId)) {
        flag(player, 'itemCheck', `Banned Item: ${item.typeId}`);
        if (config.removeIllegalItems === true) {
            updateItem();
            return;
        }
    }

    if (modified) {
        updateItem(item);
    }
}
