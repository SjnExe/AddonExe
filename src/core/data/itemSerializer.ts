import { errorLog } from '@core/utils/logger.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';

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
  dynamicProperties?: Record<string, boolean | number | string | mc.Vector3>;
  containerItems?: { slot: number; item: SerializedItem }[];
}

/** Serializes an ItemStack into a JSON-compatible object. Warning: Does not support container contents (Shulker Boxes). */
export function serializeItem(itemStack: mc.ItemStack): SerializedItem {
  const serialized: SerializedItem = {
    typeId: itemStack.typeId,
    amount: itemStack.amount,
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
      max: durability.maxDurability,
    };
  }

  // Enchantments
  const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
  if (isDefined(enchantable)) {
    const enchants = enchantable.getEnchantments();
    if (enchants.length > 0) {
      serialized.enchantments = enchants.map((e) => ({
        id: e.type.id,
        level: e.level,
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

  if (typeof itemStack.getDynamicPropertyIds === 'function') {
    const propIds = itemStack.getDynamicPropertyIds();
    if (propIds.length > 0) {
      const props: Record<string, boolean | number | string | mc.Vector3> = {};
      for (const id of propIds) {
        const val = itemStack.getDynamicProperty(id);
        if (isDefined(val)) {
          props[id] = val;
        }
      }
      if (Object.keys(props).length > 0) {
        serialized.dynamicProperties = props;
      }
    }
  }

  // Container Contents (1.26.60+ Shulker Box ItemInventoryComponent support)
  try {
    const invComp = itemStack.getComponent(ItemComponentTypes.Inventory) as mc.ItemInventoryComponent | undefined;
    const container = invComp?.container;
    if (isDefined(container)) {
      const containerItems: { slot: number; item: SerializedItem }[] = [];
      for (let i = 0; i < container.size; i++) {
        const slotItem = container.getItem(i);
        if (isDefined(slotItem)) {
          containerItems.push({ slot: i, item: serializeItem(slotItem) });
        }
      }
      if (containerItems.length > 0) {
        serialized.containerItems = containerItems;
      }
    }
  } catch {
    // Ignore if item does not have an inventory component
  }

  return serialized;
}

/** Deserializes a SerializedItem back into an ItemStack. */

export function deserializeItem(data: SerializedItem): mc.ItemStack | undefined {
  try {
    const itemType =
      isDefined(mc.ItemTypes) && typeof mc.ItemTypes.get === 'function' ? mc.ItemTypes.get(data.typeId) : data.typeId;
    if (!isDefined(itemType)) {
      errorLog(`[ItemSerializer] Unknown item type: ${data.typeId}`);
      return undefined;
    }

    const itemStack = new mc.ItemStack(itemType as mc.ItemType | string, data.amount);

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

    if (isDefined(data.dynamicProperties) && typeof itemStack.setDynamicProperty === 'function') {
      for (const [propKey, propVal] of Object.entries(data.dynamicProperties)) {
        try {
          itemStack.setDynamicProperty(propKey, propVal);
        } catch {
          // Ignore unsupported dynamic property
        }
      }
    }

    if (isDefined(data.containerItems) && data.containerItems.length > 0) {
      try {
        const invComp = itemStack.getComponent(ItemComponentTypes.Inventory) as mc.ItemInventoryComponent | undefined;
        const container = invComp?.container;
        if (isDefined(container)) {
          for (const entry of data.containerItems) {
            const nested = deserializeItem(entry.item);
            if (isDefined(nested) && entry.slot >= 0 && entry.slot < container.size) {
              container.setItem(entry.slot, nested);
            }
          }
        }
      } catch {
        // Ignore if container population fails
      }
    }

    return itemStack;
  } catch (error) {
    errorLog(`[ItemSerializer] Failed to deserialize item:`, error);
    return undefined;
  }
}
