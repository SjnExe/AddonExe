import * as mc from '@minecraft/server';

import { errorLog } from './logger.js';

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

interface ItemLockComponent extends mc.ItemComponent {
    mode: string;
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

    if (itemStack.nameTag) {
        serialized.nameTag = itemStack.nameTag;
    }

    const lore = itemStack.getLore();
    if (lore && lore.length > 0) {
        serialized.lore = lore;
    }

    // Durability
    const durability = itemStack.getComponent('minecraft:durability') as mc.ItemDurabilityComponent;
    if (durability) {
        serialized.durability = {
            damage: durability.damage,
            max: durability.maxDurability
        };
    }

    // Enchantments
    const enchantable = itemStack.getComponent('minecraft:enchantable') as mc.ItemEnchantableComponent;
    if (enchantable) {
        const enchants = enchantable.getEnchantments();
        if (enchants.length > 0) {
            serialized.enchantments = enchants.map((e) => ({
                id: e.type.id,
                level: e.level
            }));
        }
    }

    // Keep on Death
    const keepOnDeath = itemStack.getComponent('minecraft:keep_on_death');
    if (keepOnDeath) {
        serialized.keepOnDeath = true;
    }

    // Item Lock
    // Note: In some API versions, lock component access might differ.
    // We check existence.
    // As of latest beta, ItemLockComponent has 'mode'.
    try {
        const lock = itemStack.getComponent('minecraft:item_lock') as unknown as ItemLockComponent;
        if (lock && lock.mode) {
            serialized.lockMode = String(lock.mode);
        }
    } catch {
        // Ignore if not supported
    }

    // Can Destroy / Can Place On
    const canDestroy = itemStack.getCanDestroy();
    if (canDestroy && canDestroy.length > 0) {
        serialized.canDestroy = canDestroy;
    }

    const canPlaceOn = itemStack.getCanPlaceOn();
    if (canPlaceOn && canPlaceOn.length > 0) {
        serialized.canPlaceOn = canPlaceOn;
    }

    return serialized;
}

/**
 * Deserializes a SerializedItem back into an ItemStack.
 */
export function deserializeItem(data: SerializedItem): mc.ItemStack | null {
    try {
        const itemType = mc.ItemTypes.get(data.typeId);
        if (!itemType) {
            errorLog(`[ItemSerializer] Unknown item type: ${data.typeId}`);
            return null;
        }

        const itemStack = new mc.ItemStack(itemType, data.amount);

        if (data.nameTag) {
            itemStack.nameTag = data.nameTag;
        }

        if (data.lore) {
            itemStack.setLore(data.lore);
        }

        // Durability
        if (data.durability) {
            const durability = itemStack.getComponent('minecraft:durability') as mc.ItemDurabilityComponent;
            if (durability) {
                // Validate bounds
                const safeDamage = Math.max(0, Math.min(data.durability.damage, durability.maxDurability));
                durability.damage = safeDamage;
            }
        }

        // Enchantments
        if (data.enchantments) {
            const enchantable = itemStack.getComponent('minecraft:enchantable') as mc.ItemEnchantableComponent;
            if (enchantable) {
                for (const enc of data.enchantments) {
                    const type = mc.EnchantmentTypes.get(enc.id);
                    if (type) {
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
        if (data.keepOnDeath) {
            // Cannot ADD component if not present?
            // Usually components are inherent or toggled.
            // keep_on_death is often addable via creating stack? No.
            // It's a component.
            // If the item supports it, we might be able to set it?
            // Actually, dynamic components like 'keep_on_death' can be added via /give json, but API?
            // itemStack.getComponent('minecraft:keep_on_death') returns it.
            // Does it have setter?
            // Usually no.
            // So we might lose this property if the base type doesn't have it.
            // BUT, if we can't set it, we ignore it.
        }

        // Lock Mode
        if (data.lockMode) {
            try {
                const lock = itemStack.getComponent('minecraft:item_lock') as unknown as ItemLockComponent;
                if (lock) {
                    lock.mode = data.lockMode;
                }
            } catch {
                // Ignore
            }
        }

        // Can Destroy / Can Place On
        if (data.canDestroy) {
            itemStack.setCanDestroy(data.canDestroy);
        }
        if (data.canPlaceOn) {
            itemStack.setCanPlaceOn(data.canPlaceOn);
        }

        return itemStack;
    } catch (error) {
        errorLog(`[ItemSerializer] Failed to deserialize item:`, error);
        return null;
    }
}
