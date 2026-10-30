import { ItemComponentTypes } from '@minecraft/server';

import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

export interface SerializedEnchantment {
    id: string;
    level: number;
}

export interface SerializedItem {
    typeId: string;
    amount: number;
    nameTag?: string;
    lore?: string[];
    durability?: {
        damage: number;
        max: number;
    };
    enchantments?: SerializedEnchantment[];
    keepOnDeath?: boolean;
    lockMode?: string; // 'none' | 'slot' | 'inventory'
    canDestroy?: string[];
    canPlaceOn?: string[];
}

/**
 * Serializes an ItemStack into a JSON-compatible object.
 * Warning: Does not support container contents (Shulker Boxes).
 */
export function serializeItem(itemStack: mc.ItemStack): SerializedItem {
    const serialized: SerializedItem = {
        typeId: itemStack.typeId,
        amount: itemStack.amount
    };

    if (isNonEmptyString(itemStack.nameTag)) {
        serialized.nameTag = itemStack.nameTag;
    }

    const lore = itemStack.getLore();
    if (isDefined(lore) && lore.length > 0) {
        serialized.lore = lore;
    }

    // Durability
    const durability = itemStack.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent;
    if (isDefined(durability)) {
        serialized.durability = {
            damage: durability.damage,
            max: durability.maxDurability
        };
    }

    // Enchantments
    const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
    if (isDefined(enchantable)) {
        const enchants = enchantable.getEnchantments();
        if (enchants.length > 0) {
            serialized.enchantments = enchants.map((e) => ({
                id: e.type.id,
                level: e.level
            }));
        }
    }

    // Keep on Death
    if (itemStack.keepOnDeath) {
        serialized.keepOnDeath = true;
    }

    // Item Lock
    // Note: In some API versions, lock component access might differ.
    // We check existence.
    // As of latest beta, ItemLockComponent has 'mode'.
    try {
        if (isDefined(itemStack.lockMode)) {
            serialized.lockMode = itemStack.lockMode;
        }
    } catch {
        // Ignore if not supported
    }

    // Can Destroy / Can Place On
    const canDestroy = itemStack.getCanDestroy();
    if (isDefined(canDestroy) && canDestroy.length > 0) {
        serialized.canDestroy = canDestroy;
    }

    const canPlaceOn = itemStack.getCanPlaceOn();
    if (isDefined(canPlaceOn) && canPlaceOn.length > 0) {
        serialized.canPlaceOn = canPlaceOn;
    }

    return serialized;
}

/**
 * Deserializes a SerializedItem back into an ItemStack.
 */

export function deserializeItem(data: SerializedItem): mc.ItemStack | undefined {
    try {
        const itemType = mc.ItemTypes.get(data.typeId);
        if (!isDefined(itemType)) {
            errorLog(`[ItemSerializer] Unknown item type: ${data.typeId}`);
            return undefined;
        }

        const itemStack = new mc.ItemStack(itemType, data.amount);

        if (isNonEmptyString(data.nameTag)) {
            itemStack.nameTag = data.nameTag;
        }

        if (isDefined(data.lore)) {
            itemStack.setLore(data.lore);
        }

        // Durability
        if (isDefined(data.durability)) {
            const durability = itemStack.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent;
            if (isDefined(durability)) {
                // Validate bounds
                const safeDamage = Math.max(0, Math.min(data.durability.damage, durability.maxDurability));
                durability.damage = safeDamage;
            }
        }

        // Enchantments
        if (isDefined(data.enchantments)) {
            const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
            if (isDefined(enchantable)) {
                for (const enc of data.enchantments) {
                    const type = mc.EnchantmentTypes.get(enc.id);
                    if (isDefined(type)) {
                        try {
                            enchantable.addEnchantment({ type, level: enc.level });
                        } catch {
                            // Ignore invalid enchants (level too high? Item type mismatch?)
                            // We try our best.
                        }
                    }
                }
            }
        }

        // Keep on Death
        if (data.keepOnDeath === true) {
            itemStack.keepOnDeath = true;
        }

        // Lock Mode
        if (isNonEmptyString(data.lockMode)) {
            try {
                itemStack.lockMode = data.lockMode as mc.ItemLockMode;
            } catch {
                // Ignore
            }
        }

        // Can Destroy / Can Place On
        if (isDefined(data.canDestroy)) {
            itemStack.setCanDestroy(data.canDestroy);
        }
        if (isDefined(data.canPlaceOn)) {
            itemStack.setCanPlaceOn(data.canPlaceOn);
        }

        return itemStack;
    } catch (error) {
        errorLog(`[ItemSerializer] Failed to deserialize item:`, error);
        return undefined;
    }
}
