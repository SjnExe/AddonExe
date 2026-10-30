import { EntityComponentTypes } from '@minecraft/server';

import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { getOrCreatePlayer, incrementPlayerBalance, savePlayerData } from '@core/playerDataManager.js';
import { formatCooldown } from '@core/utils.js';
import { Kit } from '@features/kit/adminManager.js';
import { ItemInfo } from '@features/kit/itemsManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

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
    const config = getConfig();
    const defs = config.kits.kitDefinitions;
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
    const config = getConfig();
    if ((isDefined(config.kits) ? config.kits.enabled : undefined) !== true || !isDefined(config.kits.kitDefinitions)) {
        return [];
    }

    const pData = getOrCreatePlayer(player);
    if (!isDefined(pData)) {
        return [];
    }

    const kitDefs = config.kits.kitDefinitions as Record<string, Kit>;
    return Object.keys(kitDefs)
        .filter((kitName) => {
            const kit = kitDefs[kitName];
            if (!isDefined(kit) || kit.enabled !== true) {
                return false;
            }

            return hasPermission(player, kit.permission);
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
import { getCooldown, setCooldown } from '@core/cooldownManager.js';

export function getKitCooldown(player: mc.Player, kitName: string): number {
    return getCooldown(player.id, `kit_${kitName.toLowerCase()}`);
}

/**
 * Gives a kit to a player if they are off cooldown and the kit is enabled.
 * @param player The player to give the kit to.
 * @param kitName The name of the kit to give.
 * @returns The result of the operation.
 */
export function giveKit(player: mc.Player, kitName: string): KitResult {
    const config = getConfig();
    if ((isDefined(config.kits) ? config.kits.enabled : undefined) !== true) {
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

    if (!hasPermission(player, kit.permission)) {
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
    let isEconomyEnabled = false;
    try {
        const mainConfig = getConfig() as Record<string, unknown>;
        isEconomyEnabled = (mainConfig.economy as { enabled?: boolean }).enabled === true;
    } catch {
        // Fallback
    }

    if (isEconomyEnabled && isDefined(kit.price) && kit.price > 0 && pData.balance < kit.price) {
        return { success: false, message: `You cannot afford this kit. It costs $${kit.price}.` };
    }

    const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent;
    if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
        return { success: false, message: 'Could not access inventory.' };
    }
    const inventory = inventoryComp.container;

    if (inventory.emptySlotsCount < kit.items.length) {
        return { success: false, message: 'You do not have enough inventory space to claim this kit.' };
    }

    // All checks passed, now charge the player
    if (isEconomyEnabled && isDefined(kit.price) && kit.price > 0) {
        incrementPlayerBalance(player.id, -kit.price);
        savePlayerData(player.id);
    }

    try {
        giveKitItems(player, kit.items);

        // Set the new cooldown
        setCooldown(player.id, `kit_${lowerCaseKitName}`, kit.cooldownSeconds);

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
    const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent;
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
