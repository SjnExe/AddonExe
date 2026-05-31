import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getKitsConfig } from '@core/configurations.js';
import { errorLog } from '@core/logger.js';
import { getOrCreatePlayer, incrementPlayerBalance, savePlayerData, setKitCooldown } from '@core/playerDataManager.js';
import { formatCooldown } from '@core/utils.js';
import { Kit } from '@features/kit/adminManager.js';
import { ItemInfo } from '@features/kit/itemsManager.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';

interface KitInfo {
    name: string;
    icon: string;
    price: number;
    cooldown: number;
}

interface KitResult {
    success: boolean;
    message: string;
}

/**
 * Gets the definition of a kit from the config.
 * @param kitName The name of the kit.
 * @returns The kit definition or undefined.
 */
export function getKit(kitName: string): Kit | undefined {
    const kitsConfig = getKitsConfig();
    const defs = kitsConfig.kitDefinitions;
    if (!isDefined(defs)) {
        return undefined;
    }
    return (defs as Record<string, Kit>)[kitName.toLowerCase()];
}

/**
 * Lists all available and enabled kits for a given player.
 * @param player The player to check permissions for.
 * @returns An array of kit information objects.
 */
export function listKits(player: mc.Player): KitInfo[] {
    const mainConfig = getConfig();
    const kitsConfig = getKitsConfig();
    if ((isDefined(mainConfig.kits) ? mainConfig.kits.enabled : undefined) !== true || !isDefined(kitsConfig.kitDefinitions)) {
        return [];
    }

    const pData = getOrCreatePlayer(player);
    if (!isDefined(pData)) {
        return [];
    }

    const kitDefs = kitsConfig.kitDefinitions as Record<string, Kit>;
    return Object.keys(kitDefs)
        .filter((kitName) => {
            const kit = kitDefs[kitName];
            if (!isDefined(kit) || kit.enabled !== true) {
                return false;
            }
            const { hasPermission } = require('@core/permissionEngine.js');
            return hasPermission(player, kit?.permission ?? 'ui.panel.member');
        })
        .map((kitName) => {
            const kit = kitDefs[kitName];
            if (!isDefined(kit)) {
                // Should be unreachable due to filter, but TS checks
                return { name: kitName, icon: '', price: 0, cooldown: 0 };
            }
            return {
                name: kitName,
                icon: isNonEmptyString(kit.icon) ? kit.icon : 'textures/ui/gift_square',
                price: (isDefined(kit) ? kit.price : undefined) ?? 0,
                cooldown: getKitCooldown(player, kitName)
            };
        });
}

/**
 * Gets the remaining cooldown time for a player's kit in seconds.
 * @param player The player.
 * @param kitName The name of the kit.
 * @returns The remaining cooldown in seconds, or 0 if available.
 */
export function getKitCooldown(player: mc.Player, kitName: string): number {
    const pData = getOrCreatePlayer(player);
    if (!isDefined(pData)) {
        return 0;
    }

    const cooldownExpiry = pData.kitCooldowns[kitName.toLowerCase()];
    if (!isNumber(cooldownExpiry)) {
        return 0;
    }

    const now = Date.now();
    if (now >= cooldownExpiry) {
        return 0; // Cooldown has expired
    }

    return Math.ceil((cooldownExpiry - now) / 1000); // Return remaining seconds
}

/**
 * Gives a kit to a player if they are off cooldown and the kit is enabled.
 * @param player The player to give the kit to.
 * @param kitName The name of the kit to give.
 * @returns The result of the operation.
 */
export function giveKit(player: mc.Player, kitName: string): KitResult {
    const mainConfig = getConfig();
    if ((isDefined(mainConfig.kits) ? mainConfig.kits.enabled : undefined) !== true) {
        return { success: false, message: 'The kit system is currently disabled.' };
    }

    const lowerCaseKitName = kitName.toLowerCase();
    const kit = getKit(lowerCaseKitName);

    if (!isDefined(kit)) {
        return { success: false, message: `Kit '${kitName}' does not exist.` };
    }

    if (kit.enabled !== true) {
        return { success: false, message: `Kit '${kitName}' is currently disabled.` };
    }

    const pData = getOrCreatePlayer(player);
    if (!isDefined(pData)) {
        return { success: false, message: 'Could not find your player data.' };
    }

    // Check permissions
    const { hasPermission } = require('@core/permissionEngine.js');
    if (!hasPermission(player, kit?.permission ?? 'ui.panel.member')) {
        return { success: false, message: 'You do not have permission to claim this kit.' };
    }

    const remainingCooldown = getKitCooldown(player, lowerCaseKitName);
    if (remainingCooldown > 0) {
        return {
            success: false,
            message: `You must wait ${formatCooldown(remainingCooldown)} more to claim this kit.`
        };
    }

    // Check for price
    if (isDefined(kit.price) && kit.price > 0 && pData.balance < kit.price) {
        return { success: false, message: `You cannot afford this kit. It costs $${kit.price}.` };
    }

    const inventoryComp = player.getComponent('minecraft:inventory') as mc.EntityInventoryComponent;
    if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
        return { success: false, message: 'Could not access inventory.' };
    }
    const inventory = inventoryComp.container;

    if (inventory.emptySlotsCount < kit.items.length) {
        return { success: false, message: 'You do not have enough inventory space to claim this kit.' };
    }

    // All checks passed, now charge the player
    if (isDefined(kit.price) && kit.price > 0) {
        incrementPlayerBalance(player.id, -kit.price);
        savePlayerData(player.id);
    }

    try {
        giveKitItems(player, kit.items);

        // Set the new cooldown
        const now = Date.now();
        const newCooldown = now + kit.cooldownSeconds * 1000;
        setKitCooldown(player.id, lowerCaseKitName, newCooldown);
        savePlayerData(player.id);

        return { success: true, message: `You have received the '${kitName}' kit.` };
    } catch (error: unknown) {
        if (error instanceof Error) {
            errorLog(`[KitsManager] Failed to give kit: ${error.stack}`);
        } else {
            errorLog(`[KitsManager] Failed to give kit: ${String(error)}`);
        }
        return { success: false, message: 'An unexpected error occurred while giving the kit.' };
    }
}

/**
 * Helper to give a list of items to a player safely.
 * Handles enchantments, lore, nametags, and dropping leftovers.
 */

export function giveKitItems(player: mc.Player, items: ItemInfo[]): void {
    const inventoryComp = player.getComponent('minecraft:inventory') as mc.EntityInventoryComponent;
    if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
        throw new Error('Could not access player inventory.');
    }
    const inventory = inventoryComp.container;

    for (const itemInfo of items) {
        const itemStack = new mc.ItemStack(itemInfo.typeId, itemInfo.amount);
        if (isNonEmptyString(itemInfo.nameTag)) {
            itemStack.nameTag = itemInfo.nameTag;
        }
        if (isDefined(itemInfo.lore)) {
            itemStack.setLore(itemInfo.lore);
        }
        if (isDefined(itemInfo.enchantments)) {
            const enchantComp = itemStack.getComponent('enchantable') as mc.ItemEnchantableComponent;
            if (isDefined(enchantComp)) {
                for (const ench of itemInfo.enchantments) {
                    const type = mc.EnchantmentTypes.get(ench.id);
                    if (isDefined(type)) {
                        try {
                            enchantComp.addEnchantment({ type, level: ench.level });
                        } catch {
                            // Ignore invalid enchants
                        }
                    }
                }
            }
        }
        const leftovers = inventory.addItem(itemStack);
        if (isDefined(leftovers)) {
            player.dimension.spawnItem(leftovers, player.location);
            player.sendMessage('§eYour inventory is full. Some items were dropped on the ground.');
        }
    }
}
