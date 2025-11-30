import * as mc from '@minecraft/server';

import { getConfig } from './configManager.js';
import { getKitsConfig } from './configurations.js';
import { Kit } from './kitAdminManager.js';
import { errorLog } from './logger.js';
import { getOrCreatePlayer, setKitCooldown, incrementPlayerBalance } from './playerDataManager.js';
import { formatCooldown } from './utils.js';

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
    if (!kitsConfig.kitDefinitions) {
        return undefined;
    }
    return (kitsConfig.kitDefinitions as Record<string, Kit>)[kitName.toLowerCase()];
}

/**
 * Lists all available and enabled kits for a given player.
 * @param player The player to check permissions for.
 * @returns An array of kit information objects.
 */
export function listKits(player: mc.Player): KitInfo[] {
    const mainConfig = getConfig();
    const kitsConfig = getKitsConfig();
    if (!mainConfig.kits.enabled || !kitsConfig.kitDefinitions) {
        return [];
    }

    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return [];
    }

    const kitDefs = kitsConfig.kitDefinitions as Record<string, Kit>;
    return Object.keys(kitDefs)
        .filter((kitName) => {
            const kit = kitDefs[kitName];
            if (!kit.enabled) {
                return false;
            }
            const requiredPermission = kit.permissionLevel ?? 1024;
            return pData.permissionLevel <= requiredPermission;
        })
        .map((kitName) => {
            const kit = kitDefs[kitName];
            return {
                name: kitName,
                icon: kit.icon || 'textures/ui/gift_square',
                price: kit.price || 0,
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
    if (!pData) {
        return 0;
    }

    const cooldownExpiry = pData.kitCooldowns[kitName.toLowerCase()];
    if (!cooldownExpiry) {
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
    if (!mainConfig.kits.enabled) {
        return { success: false, message: 'The kit system is currently disabled.' };
    }

    const lowerCaseKitName = kitName.toLowerCase();
    const kit = getKit(lowerCaseKitName);

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' does not exist.` };
    }

    if (!kit.enabled) {
        return { success: false, message: `Kit '${kitName}' is currently disabled.` };
    }

    const pData = getOrCreatePlayer(player);
    if (!pData) {
        return { success: false, message: 'Could not find your player data.' };
    }

    // Check permissions
    const requiredPermission = kit.permissionLevel ?? 1024;
    if (pData.permissionLevel > requiredPermission) {
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
    if (kit.price && kit.price > 0) {
        if (pData.balance < kit.price) {
            return { success: false, message: `You cannot afford this kit. It costs $${kit.price}.` };
        }
    }

    const inventoryComp = player.getComponent('minecraft:inventory') as mc.EntityInventoryComponent;
    if (!inventoryComp || !inventoryComp.container) {
        return { success: false, message: 'Could not access inventory.' };
    }
    const inventory = inventoryComp.container;

    if (inventory.emptySlotsCount < kit.items.length) {
        return { success: false, message: 'You do not have enough inventory space to claim this kit.' };
    }

    // All checks passed, now charge the player
    if (kit.price && kit.price > 0) {
        incrementPlayerBalance(player.id, -kit.price);
    }

    try {
        for (const itemInfo of kit.items) {
            const itemStack = new mc.ItemStack(itemInfo.typeId, itemInfo.amount);
            if (itemInfo.nameTag) {
                itemStack.nameTag = itemInfo.nameTag;
            }
            if (itemInfo.lore) {
                itemStack.setLore(itemInfo.lore);
            }
            inventory.addItem(itemStack);
        }

        // Set the new cooldown
        const now = Date.now();
        const newCooldown = now + kit.cooldownSeconds * 1000;
        setKitCooldown(player.id, lowerCaseKitName, newCooldown);

        return { success: true, message: `You have received the '${kitName}' kit.` };
    } catch (e: unknown) {
        if (e instanceof Error) {
            errorLog(`[KitsManager] Failed to give kit: ${e.stack}`);
        } else {
            errorLog(`[KitsManager] Failed to give kit: ${String(e)}`);
        }
        return { success: false, message: 'An unexpected error occurred while giving the kit.' };
    }
}
