import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { playSound } from '@core/utils/index.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

const backpackStorage = new StorageManager('exe:backpacks:v1');

function loadAllBackpacks(): Map<string, SerializedItem[]> | undefined {
  const loaded = backpackStorage.load<[string, SerializedItem[]][]>();
  if (!loaded && mc.world.getDynamicProperty('exe:backpacks:v1:meta') !== undefined) {
    return undefined;
  }
  return new Map<string, SerializedItem[]>(loaded ?? []);
}

async function showBackpackPanel(player: mc.Player): Promise<void> {
  const maxSlots = Math.max(9, Math.min(54, Number(getConfig().playerUtilities?.backpackSlots ?? 18)));
  const allPacks = loadAllBackpacks();
  if (!allPacks) {
    player.sendMessage('§cFailed to load backpack data.');
    return;
  }
  const items = allPacks.get(player.id) ?? [];

  const form = new ActionFormBuilder()
    .title('Virtual Backpack')
    .body(`§7Used slots: §e${items.length}/${maxSlots}\n§7Deposit held items or tap an item to withdraw.`);

  form.button('§l§2+ Deposit Held Item', 'textures/ui/color_plus', async () => {
    if (!player.isValid) {
      return;
    }
    const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const slot = player.selectedSlotIndex;
    const held = inv?.container?.getItem(slot);
    if (!inv?.container || !isDefined(held)) {
      player.sendMessage('§cHold an item in your hand to store in your backpack.');
      return;
    }
    const latestPacks = loadAllBackpacks();
    if (!latestPacks) {
      player.sendMessage('§cFailed to load backpack data.');
      return;
    }
    const latestItems = latestPacks.get(player.id) ?? [];
    if (latestItems.length >= maxSlots) {
      player.sendMessage(`§cYour backpack is full (${maxSlots} slots).`);
      return;
    }
    latestItems.push(serializeItem(held));
    latestPacks.set(player.id, latestItems);
    if (!backpackStorage.save([...latestPacks.entries()])) {
      player.sendMessage('§cFailed to save backpack.');
      return;
    }
    inv.container.setItem(slot, undefined);
    playSound(player, 'random.pop');
    await showBackpackPanel(player);
  });

  if (items.length > 0) {
    form.button('§l§bDeposit All Matching', 'textures/ui/icon_import', async () => {
      if (!player.isValid) {
        return;
      }
      const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
      const container = inv?.container;
      if (!container) {
        return;
      }
      const latestPacks = loadAllBackpacks();
      if (!latestPacks) {
        player.sendMessage('§cFailed to load backpack data.');
        return;
      }
      const latestItems = latestPacks.get(player.id) ?? [];
      const storedTypes = new Set(latestItems.map((e) => e.typeId));
      const slotsToClear: number[] = [];
      for (let i = 0; i < container.size && latestItems.length < maxSlots; i++) {
        const it = container.getItem(i);
        if (isDefined(it) && storedTypes.has(it.typeId)) {
          latestItems.push(serializeItem(it));
          slotsToClear.push(i);
        }
      }
      if (slotsToClear.length === 0) {
        player.sendMessage('§7No matching items found in your inventory.');
        return;
      }
      latestPacks.set(player.id, latestItems);
      if (!backpackStorage.save([...latestPacks.entries()])) {
        player.sendMessage('§cFailed to save backpack.');
        return;
      }
      for (const s of slotsToClear) {
        container.setItem(s, undefined);
      }
      playSound(player, 'random.pop');
      player.sendMessage(`§aDeposited §e${slotsToClear.length}§a matching stack(s)!`);
      await showBackpackPanel(player);
    });
  }

  items.forEach((entry, idx) => {
    const name = resolveTradeItemDisplayName(entry.typeId, entry.nameTag);
    const icon = resolveTradeItemIcon(entry.typeId);
    form.button(`§f${name} §7x${entry.amount}`, icon, async () => {
      if (!player.isValid) {
        return;
      }
      const latestPacks = loadAllBackpacks();
      if (!latestPacks) {
        player.sendMessage('§cFailed to load backpack data.');
        return;
      }
      const latestItems = latestPacks.get(player.id) ?? [];
      const currentEntry = latestItems[idx];
      if (!currentEntry || currentEntry.typeId !== entry.typeId) {
        await showBackpackPanel(player);
        return;
      }
      const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
      const stack = deserializeItem(currentEntry);
      if (!inv?.container || !isDefined(stack)) {
        return;
      }
      const originalEntry = currentEntry;
      latestItems.splice(idx, 1);
      latestPacks.set(player.id, latestItems);
      if (!backpackStorage.save([...latestPacks.entries()])) {
        player.sendMessage('§cFailed to save backpack.');
        return;
      }
      const countMatchingInContainer = (): number => {
        let total = 0;
        for (let i = 0; i < inv.container!.size; i++) {
          const item = inv.container!.getItem(i);
          if (item && item.typeId === originalEntry.typeId) {
            total += item.amount;
          }
        }
        return total;
      };
      const beforeCount = countMatchingInContainer();
      let leftover: mc.ItemStack | undefined;
      try {
        leftover = inv.container.addItem(stack);
      } catch {
        const afterCount = countMatchingInContainer();
        const insertedAmount = Math.max(0, Math.min(originalEntry.amount, afterCount - beforeCount));
        const uninsertedAmount = originalEntry.amount - insertedAmount;
        if (uninsertedAmount > 0) {
          const restoreEntry: SerializedItem = { ...originalEntry, amount: uninsertedAmount };
          latestItems.splice(idx, 0, restoreEntry);
          const restoreStatus = backpackStorage.saveWithStatus([...latestPacks.entries()]);
          if (restoreStatus === 'rolled_back') {
            const dropStack = deserializeItem(restoreEntry);
            if (isDefined(dropStack)) {
              player.dimension.spawnItem(dropStack, player.location);
            }
          } else if (restoreStatus === 'indeterminate') {
            player.sendMessage('§cBackpack storage write was interrupted; check /backpack before retrying.');
          }
        }
        player.sendMessage('§cFailed to add item to inventory.');
        return;
      }
      if (isDefined(leftover)) {
        if (leftover.amount === originalEntry.amount) {
          latestItems.splice(idx, 0, originalEntry);
          const restoreStatus = backpackStorage.saveWithStatus([...latestPacks.entries()]);
          if (restoreStatus === 'rolled_back') {
            player.dimension.spawnItem(stack, player.location);
          } else if (restoreStatus === 'indeterminate') {
            player.sendMessage('§cBackpack storage write was interrupted; check /backpack before retrying.');
            return;
          }
          player.sendMessage('§cNot enough inventory space!');
          return;
        }
        latestItems.splice(idx, 0, serializeItem(leftover));
        const restoreStatus = backpackStorage.saveWithStatus([...latestPacks.entries()]);
        if (restoreStatus === 'rolled_back') {
          player.dimension.spawnItem(leftover, player.location);
        } else if (restoreStatus === 'indeterminate') {
          player.sendMessage('§cBackpack storage write was interrupted; check /backpack before retrying.');
        }
      }
      playSound(player, 'random.pop');
      await showBackpackPanel(player);
    });
  });

  await form.show(player);
}

const backpackCommand: CustomCommand = {
  name: 'backpack',
  aliases: ['bp'],
  description: 'Opens your personal virtual backpack storage.',
  category: 'Essentials',
  permissionNode: 'cmd.backpack.vip',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getConfig().playerUtilities?.backpackEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cVirtual Backpacks (/backpack) are currently disabled.');
      return;
    }
    mc.system.run(() => {
      if (executor.isValid) {
        void showBackpackPanel(executor);
      }
    });
  },
};

export default backpackCommand;
