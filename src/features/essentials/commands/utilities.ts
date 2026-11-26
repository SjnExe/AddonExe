import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { getOrCreatePlayer, getVisiblePlayers, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound, resolveTarget } from '@core/utils/index.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes } from '@minecraft/server';
import { MinecraftEffectTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

const healCommand: CustomCommand = {
  name: 'heal',
  description: 'Restores health to full for yourself or a target player.',
  category: 'Essentials',
  permissionNode: 'cmd.heal.vip',
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.healEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /heal command is currently disabled.');
      return;
    }

    let target: mc.Player = executor;
    if (isNonEmptyString(args.target)) {
      if (!hasPermission(executor, 'group.admin')) {
        executor.sendMessage('§cOnly administrators can heal other players.');
        return;
      }
      const found = resolveTarget(args.target, executor)[0];
      if (!isDefined(found)) {
        executor.sendMessage('§cPlayer not found.');
        return;
      }
      target = found;
    }

    const healthComp = target.getComponent(EntityComponentTypes.Health) as mc.EntityHealthComponent | undefined;
    if (!isDefined(healthComp)) {
      executor.sendMessage('§cCould not access health component.');
      return;
    }

    const healCost = Math.max(0, Number(cfg.playerUtilities?.healCost ?? 0));
    const chargeHeal = isFeatureActive('eco') && healCost > 0 && !hasPermission(executor, 'group.admin');
    if (chargeHeal) {
      if (getOrCreatePlayer(executor).balance < healCost) {
        executor.sendMessage(`§cInsufficient funds for /heal (${formatCurrency(healCost)} required).`);
        return;
      }
      incrementPlayerBalance(executor.id, -healCost);
    }

    healthComp.resetToMaxValue();
    playSound(target, 'random.orb');

    if (target.id === executor.id) {
      const costTag = chargeHeal ? ` §7(-${formatCurrency(healCost)})` : '';
      executor.sendMessage(`§aYour health has been fully restored!${costTag}`);
    } else {
      executor.sendMessage(`§aHealed §e${target.name}§a to full health.`);
      target.sendMessage(`§aYou have been healed by §e${executor.name}§a!`);
    }
  },
};

const feedCommand: CustomCommand = {
  name: 'feed',
  aliases: ['eat'],
  description: 'Restores hunger and saturation for yourself or a target player.',
  category: 'Essentials',
  permissionNode: 'cmd.feed.vip',
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.feedEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /feed command is currently disabled.');
      return;
    }

    let target: mc.Player = executor;
    if (isNonEmptyString(args.target)) {
      if (!hasPermission(executor, 'group.admin')) {
        executor.sendMessage('§cOnly administrators can feed other players.');
        return;
      }
      const found = resolveTarget(args.target, executor)[0];
      if (!isDefined(found)) {
        executor.sendMessage('§cPlayer not found.');
        return;
      }
      target = found;
    }

    const feedCost = Math.max(0, Number(cfg.playerUtilities?.feedCost ?? 0));
    const chargeFeed = isFeatureActive('eco') && feedCost > 0 && !hasPermission(executor, 'group.admin');
    if (chargeFeed) {
      if (getOrCreatePlayer(executor).balance < feedCost) {
        executor.sendMessage(`§cInsufficient funds for /feed (${formatCurrency(feedCost)} required).`);
        return;
      }
      incrementPlayerBalance(executor.id, -feedCost);
    }

    target.addEffect(MinecraftEffectTypes.Saturation, 2, { amplifier: 255, showParticles: false });
    playSound(target, 'random.burp');

    if (target.id === executor.id) {
      const costTag = chargeFeed ? ` §7(-${formatCurrency(feedCost)})` : '';
      executor.sendMessage(`§aYour appetite has been fully satisfied!${costTag}`);
    } else {
      executor.sendMessage(`§aFed §e${target.name}§a.`);
      target.sendMessage(`§aYour hunger was restored by §e${executor.name}§a!`);
    }
  },
};

interface RepairArgs {
  scope?: string;
}

const repairCommand: CustomCommand = {
  name: 'repair',
  aliases: ['fix'],
  description: 'Repairs the item currently held in your main hand or all equipment/inventory items.',
  category: 'Essentials',
  permissionNode: 'cmd.repair.vip',
  parameters: [
    {
      name: 'scope',
      type: 'string',
      description: 'Specify "all" to repair all inventory and equipped gear, or leave blank for held item.',
      optional: true,
    },
  ],
  execute: (executor: CommandExecutor, args: RepairArgs) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.repairEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /repair command is currently disabled.');
      return;
    }

    const rawScope = typeof args?.scope === 'string' ? args.scope.trim().toLowerCase() : undefined;
    if (isDefined(rawScope) && rawScope !== 'all' && rawScope !== 'hand') {
      executor.sendMessage('§cInvalid argument. Usage: /repair [all]');
      return;
    }

    const isAll = rawScope === 'all';
    if (isAll && !hasPermission(executor, 'cmd.repair.all.vip') && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cYou do not have permission to use /repair all.');
      return;
    }

    const equipComp = executor.getComponent(EntityComponentTypes.Equippable) as
      mc.EntityEquippableComponent | undefined;
    const invComp = executor.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const unitCost = Math.max(0, Number(cfg.playerUtilities?.repairCost ?? 0));

    if (isAll) {
      const itemsToRepair: Array<{
        restore: () => void;
      }> = [];

      const armorSlots = [
        mc.EquipmentSlot.Head,
        mc.EquipmentSlot.Chest,
        mc.EquipmentSlot.Legs,
        mc.EquipmentSlot.Feet,
        mc.EquipmentSlot.Offhand,
      ];

      for (const slot of armorSlots) {
        const item = equipComp?.getEquipment(slot);
        if (!isDefined(item)) {
          continue;
        }
        const durability = item.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
        if (isDefined(durability) && durability.damage > 0) {
          itemsToRepair.push({
            restore: () => {
              durability.damage = 0;
              equipComp?.setEquipment(slot, item);
            },
          });
        }
      }

      const container = invComp?.container;
      if (isDefined(container)) {
        for (let i = 0; i < container.size; i++) {
          const item = container.getItem(i);
          if (!isDefined(item)) {
            continue;
          }
          const durability = item.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
          if (isDefined(durability) && durability.damage > 0) {
            itemsToRepair.push({
              restore: () => {
                durability.damage = 0;
                container.setItem(i, item);
              },
            });
          }
        }
      }

      if (itemsToRepair.length === 0) {
        executor.sendMessage('§cNone of your equipment or inventory items need repairing.');
        return;
      }

      const totalCost = unitCost * itemsToRepair.length;
      if (totalCost > 0 && isFeatureActive('eco') && !hasPermission(executor, 'group.admin')) {
        const pData = getOrCreatePlayer(executor);
        if (pData.balance < totalCost) {
          executor.sendMessage(
            `§cInsufficient funds to repair ${itemsToRepair.length} items (${formatCurrency(totalCost)} required).`,
          );
          return;
        }
        incrementPlayerBalance(executor.id, -totalCost);
      }

      for (const entry of itemsToRepair) {
        entry.restore();
      }

      playSound(executor, 'random.anvil_use');
      const costSuffix =
        totalCost > 0 && isFeatureActive('eco') && !hasPermission(executor, 'group.admin')
          ? ` §7(-${formatCurrency(totalCost)})`
          : '';
      executor.sendMessage(`§aSuccessfully repaired §e${itemsToRepair.length}§a item(s)!${costSuffix}`);
      return;
    }

    const heldItem = equipComp?.getEquipment(mc.EquipmentSlot.Mainhand);
    if (!isDefined(heldItem)) {
      executor.sendMessage('§cYou are not holding an item in your main hand.');
      return;
    }

    const durability = heldItem.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
    if (!isDefined(durability) || durability.damage <= 0) {
      executor.sendMessage('§cThis item does not need repairing.');
      return;
    }

    if (unitCost > 0 && isFeatureActive('eco') && !hasPermission(executor, 'group.admin')) {
      const pData = getOrCreatePlayer(executor);
      if (pData.balance < unitCost) {
        executor.sendMessage(`§cInsufficient funds to repair item (${formatCurrency(unitCost)} required).`);
        return;
      }
      incrementPlayerBalance(executor.id, -unitCost);
    }

    durability.damage = 0;
    equipComp?.setEquipment(mc.EquipmentSlot.Mainhand, heldItem);
    playSound(executor, 'random.anvil_use');

    const costSuffix =
      unitCost > 0 && isFeatureActive('eco') && !hasPermission(executor, 'group.admin')
        ? ` §7(-${formatCurrency(unitCost)})`
        : '';
    executor.sendMessage(`§aSuccessfully repaired your held item!${costSuffix}`);
  },
};

export async function showTrashPanel(player: mc.Player): Promise<void> {
  const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const container = invComp?.container;
  if (!isDefined(container)) {
    player.sendMessage('§cCould not access your inventory.');
    return;
  }

  const form = new ActionFormBuilder()
    .title('Trash & Item Disposal')
    .body('§cSelect an inventory stack below to permanently destroy it:');

  let hasItems = false;
  for (let i = 0; i < container.size; i++) {
    const slotIdx = i;
    const item = container.getItem(slotIdx);
    if (!isDefined(item) || item.typeId === 'exe:panel') {
      continue;
    }
    hasItems = true;
    const displayName = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
    form.button(`Slot ${slotIdx}: ${displayName} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
      await showConfirmationDialog(player, {
        title: 'Confirm Item Disposal',
        body: `Permanently destroy §e${displayName} x${item.amount}§f from Slot ${slotIdx}?`,
        confirmButtonText: '§4Destroy Item',
        onConfirm: async () => {
          container.setItem(slotIdx, undefined);
          playSound(player, 'random.fizz');
          player.sendMessage(`§aDisposed of ${displayName} x${item.amount}.`);
          await showTrashPanel(player);
        },
        onCancel: async () => {
          await showTrashPanel(player);
        },
      });
    });
  }

  if (!hasItems) {
    form.body('§7Your inventory has no disposable items.');
  }

  await form.show(player);
}

const trashCommand: CustomCommand = {
  name: 'trash',
  aliases: ['dispose', 'bin'],
  description: 'Opens the safe item disposal menu to permanently delete unwanted items.',
  category: 'General',
  permissionNode: 'cmd.trash.member',
  execute: async (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.trashEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /trash command is currently disabled.');
      return;
    }

    await showTrashPanel(executor);
  },
};

const nearCommand: CustomCommand = {
  name: 'near',
  aliases: ['nearby'],
  description: 'Lists nearby visible players and their distances.',
  category: 'General',
  permissionNode: 'cmd.near.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.playerUtilities?.nearEnabled && !hasPermission(executor, 'group.mod')) {
      executor.sendMessage('§cThe /near command is currently disabled.');
      return;
    }

    const radius = Math.max(10, Number(cfg.playerUtilities?.nearRadius ?? 100));
    const visible = getVisiblePlayers(executor);
    const nearby: { name: string; distance: number }[] = [];

    for (const other of visible) {
      if (!other.isValid || other.id === executor.id || other.dimension.id !== executor.dimension.id) {
        continue;
      }
      const dist = Math.round(Vector3Utils.distance(executor.location, other.location));
      if (dist <= radius) {
        nearby.push({ name: other.name, distance: dist });
      }
    }

    nearby.sort((a, b) => a.distance - b.distance);

    if (nearby.length === 0) {
      executor.sendMessage(`§7No players found within ${radius} blocks.`);
      return;
    }

    const listStr = nearby.map((p) => `§e${p.name} §7(${p.distance}m)`).join('§8, ');
    executor.sendMessage(`§aNearby Players (${nearby.length} within ${radius}m): ${listStr}`);
  },
};

const hatCommand: CustomCommand = {
  name: 'hat',
  description: 'Equips the item in your main hand onto your head.',
  category: 'Essentials',
  permissionNode: 'cmd.hat.vip',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const cfg = getConfig();
    if (!cfg.playerUtilities?.hatEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /hat command is currently disabled.');
      return;
    }
    const inv = executor.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const eq = executor.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
    if (!inv?.container || !eq) {
      return;
    }
    const slot = executor.selectedSlotIndex;
    const held = inv.container.getItem(slot);
    if (!isDefined(held)) {
      executor.sendMessage('§cHold an item in your hand to wear as a hat.');
      return;
    }
    const currentHead = eq.getEquipment(EquipmentSlot.Head);
    if (held.amount > 1 && isDefined(currentHead)) {
      executor.sendMessage('§cRemove your current helmet or hold a single item to swap.');
      return;
    }
    const hatItem = held.clone();
    hatItem.amount = 1;
    const equipped = eq.setEquipment(EquipmentSlot.Head, hatItem);
    if (!equipped) {
      executor.sendMessage('§cCould not equip that item onto your head.');
      return;
    }
    if (held.amount > 1) {
      held.amount -= 1;
      inv.container.setItem(slot, held);
    } else {
      inv.container.setItem(slot, currentHead);
    }
    playSound(executor, 'armor.equip_generic');
    executor.sendMessage('§aEnjoy your new hat!');
  },
};

const enderVaultStorage = new StorageManager('exe:enderVault:v1');

async function showEnderVaultPanel(player: mc.Player): Promise<void> {
  const allVaults = new Map<string, SerializedItem[]>(enderVaultStorage.load<[string, SerializedItem[]][]>() ?? []);
  const items = allVaults.get(player.id) ?? [];
  const form = new ActionFormBuilder()
    .title('Virtual Ender Chest')
    .body(`§7Stored stacks: §e${items.length}/27\n§7Deposit your held item or withdraw stored items.`);

  form.button('§l§2+ Deposit Held Item', 'textures/ui/color_plus', async () => {
    if (!player.isValid) {
      return;
    }
    const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const slot = player.selectedSlotIndex;
    const held = inv?.container?.getItem(slot);
    if (!inv?.container || !isDefined(held)) {
      player.sendMessage('§cHold an item in your hand to deposit.');
      return;
    }
    const latestVaults = new Map<string, SerializedItem[]>(
      enderVaultStorage.load<[string, SerializedItem[]][]>() ?? [],
    );
    const latestItems = latestVaults.get(player.id) ?? [];
    if (latestItems.length >= 27) {
      player.sendMessage('§cYour Virtual Ender Chest is full (27 slots).');
      return;
    }
    latestItems.push(serializeItem(held));
    latestVaults.set(player.id, latestItems);
    if (!enderVaultStorage.save([...latestVaults.entries()])) {
      player.sendMessage('§cFailed to save Virtual Ender Chest. Deposit aborted.');
      return;
    }
    inv.container.setItem(slot, undefined);
    playSound(player, 'random.enderchestopen');
    await showEnderVaultPanel(player);
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
      const latestVaults = new Map<string, SerializedItem[]>(
        enderVaultStorage.load<[string, SerializedItem[]][]>() ?? [],
      );
      const latestItems = latestVaults.get(player.id) ?? [];
      const storedTypes = new Set(latestItems.map((e) => e.typeId));
      const slotsToClear: number[] = [];
      for (let i = 0; i < container.size && latestItems.length < 27; i++) {
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
      latestVaults.set(player.id, latestItems);
      if (!enderVaultStorage.save([...latestVaults.entries()])) {
        player.sendMessage('§cFailed to save Virtual Ender Chest.');
        return;
      }
      for (const s of slotsToClear) {
        container.setItem(s, undefined);
      }
      playSound(player, 'random.enderchestopen');
      player.sendMessage(`§aDeposited §e${slotsToClear.length}§a matching stack(s)!`);
      await showEnderVaultPanel(player);
    });
  }

  items.forEach((entry, idx) => {
    const name = resolveTradeItemDisplayName(entry.typeId, entry.nameTag);
    const icon = resolveTradeItemIcon(entry.typeId);
    form.button(`§f${name} §7x${entry.amount}`, icon, async () => {
      if (!player.isValid) {
        return;
      }
      const latestVaults = new Map<string, SerializedItem[]>(
        enderVaultStorage.load<[string, SerializedItem[]][]>() ?? [],
      );
      const latestItems = latestVaults.get(player.id) ?? [];
      const currentEntry = latestItems[idx];
      if (!currentEntry || currentEntry.typeId !== entry.typeId) {
        await showEnderVaultPanel(player);
        return;
      }
      const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
      const stack = deserializeItem(currentEntry);
      if (!inv?.container || !isDefined(stack)) {
        return;
      }
      const leftover = inv.container.addItem(stack);
      if (isDefined(leftover)) {
        if (leftover.amount === currentEntry.amount) {
          player.sendMessage('§cNot enough inventory space!');
          return;
        }
        latestItems[idx] = serializeItem(leftover);
      } else {
        latestItems.splice(idx, 1);
      }
      latestVaults.set(player.id, latestItems);
      if (!enderVaultStorage.save([...latestVaults.entries()])) {
        player.sendMessage('§cFailed to save Virtual Ender Chest.');
        return;
      }
      playSound(player, 'random.pop');
      await showEnderVaultPanel(player);
    });
  });

  await form.show(player);
}

const enderchestCommand: CustomCommand = {
  name: 'enderchest',
  aliases: ['ec'],
  description: 'Opens your personal virtual Ender Chest storage.',
  category: 'Essentials',
  permissionNode: 'cmd.enderchest.vip',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const cfg = getConfig();
    if (!cfg.playerUtilities?.enderchestEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /enderchest command is currently disabled.');
      return;
    }
    mc.system.run(() => {
      if (executor.isValid) {
        void showEnderVaultPanel(executor);
      }
    });
  },
};

interface QuickRecipe {
  label: string;
  inputType: string;
  inputAmount: number;
  outputType: string;
  outputAmount: number;
  icon: string;
}

const quickWorkbenchRecipes: QuickRecipe[] = [
  {
    label: 'Stick x4 (2 Oak Planks)',
    inputType: MinecraftItemTypes.OakPlanks,
    inputAmount: 2,
    outputType: MinecraftItemTypes.Stick,
    outputAmount: 4,
    icon: 'textures/items/stick',
  },
  {
    label: 'Crafting Table (4 Oak Planks)',
    inputType: MinecraftItemTypes.OakPlanks,
    inputAmount: 4,
    outputType: MinecraftItemTypes.CraftingTable,
    outputAmount: 1,
    icon: 'textures/blocks/crafting_table_top',
  },
  {
    label: 'Chest (8 Oak Planks)',
    inputType: MinecraftItemTypes.OakPlanks,
    inputAmount: 8,
    outputType: MinecraftItemTypes.Chest,
    outputAmount: 1,
    icon: 'textures/blocks/chest_front',
  },
  {
    label: 'Furnace (8 Cobblestone)',
    inputType: MinecraftItemTypes.Cobblestone,
    inputAmount: 8,
    outputType: MinecraftItemTypes.Furnace,
    outputAmount: 1,
    icon: 'textures/blocks/furnace_front_off',
  },
  {
    label: 'Bread x1 (3 Wheat)',
    inputType: MinecraftItemTypes.Wheat,
    inputAmount: 3,
    outputType: MinecraftItemTypes.Bread,
    outputAmount: 1,
    icon: 'textures/items/bread',
  },
];

async function showWorkbenchPanel(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder()
    .title('Portable Workbench')
    .body('§7Quick-craft essential survival items from your inventory.');

  for (const recipe of quickWorkbenchRecipes) {
    form.button(recipe.label, recipe.icon, async () => {
      const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
      const container = inv?.container;
      if (!container) {
        return;
      }
      let available = 0;
      for (let i = 0; i < container.size; i++) {
        const it = container.getItem(i);
        if (it?.typeId === recipe.inputType) {
          available += it.amount;
        }
      }
      if (available < recipe.inputAmount) {
        player.sendMessage(
          `§cMissing materials! Need ${recipe.inputAmount}x ${recipe.inputType.replace('minecraft:', '')}.`,
        );
        return;
      }
      let toConsume = recipe.inputAmount;
      for (let i = 0; i < container.size && toConsume > 0; i++) {
        const it = container.getItem(i);
        if (it?.typeId === recipe.inputType) {
          const take = Math.min(it.amount, toConsume);
          toConsume -= take;
          if (it.amount - take <= 0) {
            container.setItem(i, undefined);
          } else {
            it.amount -= take;
            container.setItem(i, it);
          }
        }
      }
      const leftover = container.addItem(new mc.ItemStack(recipe.outputType, recipe.outputAmount));
      if (isDefined(leftover)) {
        player.dimension.spawnItem(leftover, player.location);
      }
      playSound(player, 'random.pop');
      player.sendMessage(`§aCrafted §e${recipe.outputAmount}x ${recipe.outputType.replace('minecraft:', '')}§a!`);
      await showWorkbenchPanel(player);
    });
  }

  await form.show(player);
}

const workbenchCommand: CustomCommand = {
  name: 'workbench',
  aliases: ['wb', 'craft'],
  description: 'Opens a portable quick-craft workbench.',
  category: 'Essentials',
  permissionNode: 'cmd.workbench.vip',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const cfg = getConfig();
    if (!cfg.playerUtilities?.workbenchEnabled && !hasPermission(executor, 'group.admin')) {
      executor.sendMessage('§cThe /workbench command is currently disabled.');
      return;
    }
    mc.system.run(() => {
      if (executor.isValid) {
        void showWorkbenchPanel(executor);
      }
    });
  },
};

export default [
  healCommand,
  feedCommand,
  repairCommand,
  trashCommand,
  nearCommand,
  hatCommand,
  enderchestCommand,
  workbenchCommand,
];
