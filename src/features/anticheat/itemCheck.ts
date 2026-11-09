import { AnticheatConfig, getAnticheatConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { registerEvent } from '@core/events/eventManager.js';
import { errorLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval, setTrackedJob } from '@core/utils/timerManager.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import { flag } from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';

let isChecking = false;
let itemCheckIntervalId: number | undefined;
let isItemCheckRegistered = false;

/** Starts the periodic inventory inspection loop and registers item change event listeners. */
export function startItemCheckLoop(): void {
  if (!isItemCheckRegistered && isDefined(mc.world?.afterEvents?.playerInventoryItemChange)) {
    registerEvent(
      mc.world.afterEvents.playerInventoryItemChange,
      handlePlayerInventoryItemChange,
      'playerInventoryItemChange',
    );
    isItemCheckRegistered = true;
  }

  if (isDefined(itemCheckIntervalId)) {
    clearTrackedInterval(itemCheckIntervalId);
  }

  itemCheckIntervalId = setTrackedInterval(() => {
    if (isChecking) {
      return;
    }
    try {
      const config = getAnticheatConfig();
      if (config.enabled !== true || config.itemCheck.enabled !== true) {
        return;
      }

      setTrackedJob(checkInventoryGenerator(config));
    } catch (error) {
      errorLog('Anticheat Item Loop Error', error);
    }
  }, 100); // Check equipment every 5 seconds
}

const mutatingSlots = new Set<string>();

/**
 * Evaluates individual slot item modifications to detect illegal items immediately upon inventory interaction.
 *
 * @param event The player inventory item change after-event payload.
 */
export function handlePlayerInventoryItemChange(event: mc.PlayerInventoryItemChangeAfterEvent): void {
  const player = event.player;
  if (!player || !player.isValid) {
    return;
  }

  const config = getAnticheatConfig();
  if (config.enabled !== true || config.itemCheck.enabled !== true) {
    return;
  }

  if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) {
    return;
  }

  const item = event.itemStack;
  if (!isDefined(item)) {
    return;
  }

  const inventory = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  if (!isDefined(inventory?.container)) {
    return;
  }

  const container = inventory.container;
  // Hotbar slots are 0..8; Main inventory slots 0..26 map to container slots 9..35
  const targetSlot = event.inventoryType === mc.PlayerInventoryType.Inventory ? event.slot + 9 : event.slot;
  if (targetSlot < 0 || targetSlot >= container.size) {
    return;
  }

  const slotKey = `${player.id}:${targetSlot}`;
  if (mutatingSlots.has(slotKey)) {
    return;
  }

  const bannedSet = getBannedItemSet(config.itemCheck.bannedItems);
  checkItem(
    item,
    player,
    config.itemCheck,
    (newItem) => {
      mutatingSlots.add(slotKey);
      try {
        container.setItem(targetSlot, newItem);
      } catch {
        // Ignore slot mutation conflicts
      } finally {
        if (typeof mc.system?.run === 'function') {
          mc.system.run(() => {
            mutatingSlots.delete(slotKey);
          });
        } else {
          mutatingSlots.delete(slotKey);
        }
      }
    },
    bannedSet,
  );
}

function* checkInventoryGenerator(config: AnticheatConfig) {
  isChecking = true;
  try {
    const players = getAllPlayersFromCache();
    const bannedSet = getBannedItemSet(config.itemCheck.bannedItems);
    for (const player of players) {
      if (player.isValid) {
        checkPlayerEquipment(player, config.itemCheck, bannedSet);
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

let cachedBannedArrayRef: string[] | undefined;
let cachedBannedSet = new Set<string>();

function getBannedItemSet(bannedItems: string[]): Set<string> {
  if (cachedBannedArrayRef !== bannedItems) {
    cachedBannedArrayRef = bannedItems;
    cachedBannedSet = new Set(bannedItems ?? []);
  }
  return cachedBannedSet;
}

/**
 * Inspects all armor and offhand equipment slots on a player.
 *
 * @param player The player whose equipment is inspected.
 * @param config Item check configuration parameters.
 * @param bannedSet Optional pre-computed Set of banned item identifiers.
 */
export function checkPlayerEquipment(player: mc.Player, config: ItemCheckConfig, bannedSet?: Set<string>): void {
  if (!player || !player.isValid) {
    return;
  }
  if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) {
    return;
  }

  const effectiveBannedSet = bannedSet ?? getBannedItemSet(config.bannedItems);
  const equippable = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent;
  if (isDefined(equippable)) {
    const slots = [
      mc.EquipmentSlot.Head,
      mc.EquipmentSlot.Chest,
      mc.EquipmentSlot.Legs,
      mc.EquipmentSlot.Feet,
      mc.EquipmentSlot.Offhand,
    ];

    for (const slot of slots) {
      const item = equippable.getEquipment(slot);
      if (isDefined(item)) {
        checkItem(item, player, config, (newItem) => equippable.setEquipment(slot, newItem), effectiveBannedSet);
      }
    }
  }
}

/**
 * Inspects the entire inventory (main container + equipment) of a player.
 *
 * @param player The player whose full inventory is inspected.
 * @param config Item check configuration parameters.
 * @param bannedSet Optional pre-computed Set of banned item identifiers.
 */
export function checkPlayerInventory(player: mc.Player, config: ItemCheckConfig, bannedSet?: Set<string>): void {
  if (!player || !player.isValid) {
    return;
  }
  if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) {
    return;
  }

  const effectiveBannedSet = bannedSet ?? getBannedItemSet(config.bannedItems);

  // Check Main Inventory
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent;
  if (isDefined(inventory) && isDefined(inventory.container)) {
    const container = inventory.container;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (isDefined(item)) {
        checkItem(item, player, config, (newItem) => container.setItem(i, newItem), effectiveBannedSet);
      }
    }
  }

  // Check Equipment (Armor + Offhand)
  checkPlayerEquipment(player, config, effectiveBannedSet);
}

/**
 * Verifies a single item stack against illegal stack sizes, enchantment levels, and banned item identifiers.
 *
 * @param item The item stack under inspection.
 * @param player The player holding the item stack.
 * @param config Item check configuration parameters.
 * @param updateItem Callback invoked to replace or remove the item stack if modified or purged.
 * @param bannedSet Optional pre-computed Set of banned item identifiers.
 */
export function checkItem(
  item: mc.ItemStack,
  player: mc.Player,
  config: ItemCheckConfig,
  updateItem: (item?: mc.ItemStack) => void,
  bannedSet?: Set<string>,
): void {
  const maxEnchantLevel = config.maxEnchantLevel ?? 5;
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
  const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
  if (isDefined(enchantable) && 'getEnchantments' in enchantable) {
    const enchants = enchantable.getEnchantments();
    for (const enchant of enchants) {
      const vanillaMax = enchant.type.maxLevel;
      const allowed = Math.max(maxEnchantLevel, vanillaMax);

      if (enchant.level > allowed && config.illegalEnchantments === true) {
        flag(player, 'itemCheck', `Illegal Enchant: ${enchant.type.id} Level ${enchant.level} (Max: ${allowed})`);
        if (config.removeIllegalItems === true) {
          updateItem(); // Remove item
          return;
        }
      }
    }
  }

  // Check Banned ID
  const effectiveBannedSet = bannedSet ?? getBannedItemSet(config.bannedItems);
  if (effectiveBannedSet.has(item.typeId)) {
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

/** Clears mutating slot tracking states for test isolation. */
export function _clearItemCheckForTest(): void {
  mutatingSlots.clear();
  isChecking = false;
  isItemCheckRegistered = false;
  if (isDefined(itemCheckIntervalId)) {
    clearTrackedInterval(itemCheckIntervalId);
    itemCheckIntervalId = undefined;
  }
}

/** Modular item check registration. */
export const itemCheck: AntiCheatCheck = {
  id: 'itemCheck',
  name: 'Item & Inventory Inspection Check',
  category: 'inventory',
  description: 'Inspects item stack sizes, enchantment levels, and banned item possession.',
  start: () => startItemCheckLoop(),
  stop: () => {
    if (isItemCheckRegistered) {
      try {
        mc.world?.afterEvents?.playerInventoryItemChange?.unsubscribe?.(handlePlayerInventoryItemChange);
      } catch {
        // Ignore unsubscribe errors in test environments
      }
      isItemCheckRegistered = false;
    }
    if (isDefined(itemCheckIntervalId)) {
      clearTrackedInterval(itemCheckIntervalId);
      itemCheckIntervalId = undefined;
    }
  },
  clearPlayer: (_playerId: string) => {},
  reset: () => _clearItemCheckForTest(),
};

checkRegistry.registerCheck(itemCheck);
