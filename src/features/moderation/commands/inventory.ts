import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import {
  getPlayerIdByName,
  getPlayerNameById,
  loadPlayerData,
  updatePlayerData,
} from '@core/data/playerDataManager.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { resolveTarget } from '@core/utils/index.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';

function inspectArmor(equipment: mc.EntityEquippableComponent): string {
  let output = '';
  const armorSlots = [
    mc.EquipmentSlot.Head,
    mc.EquipmentSlot.Chest,
    mc.EquipmentSlot.Legs,
    mc.EquipmentSlot.Feet,
    mc.EquipmentSlot.Offhand,
  ];
  const armorNames = ['Head', 'Chest', 'Legs', 'Feet', 'Offhand'];

  output += '§6[Armor & Offhand]§r\n';
  for (const [index, slot] of armorSlots.entries()) {
    const item = equipment.getEquipment(slot);
    if (isDefined(item)) {
      const name = isDefined(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
      output += ` §7${armorNames[index]}: §f${name} §7x${item.amount}\n`;
    }
  }
  return output;
}

function inspectInventory(inventory: mc.Container): string {
  let output = '';
  output += '§6[Inventory]§r\n';
  const hotbarSize = 9;

  for (let i = 0; i < inventory.size; i++) {
    const item = inventory.getItem(i);
    if (isDefined(item)) {
      const name = isDefined(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
      const isHotbar = i < hotbarSize;
      const prefix = isHotbar ? '§e' : '§7';
      output += ` ${prefix}[${i}] §f${name} §7x${item.amount}\n`;
    }
  }
  return output;
}

const invseeCommand: CustomCommand = {
  name: 'invsee',
  description: 'View the inventory of an online or offline player.',
  category: 'Moderation',
  permissionNode: 'cmd.invsee.mod',
  allowConsole: true,
  parameters: [{ name: 'player', type: 'string', optional: false }],
  execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
    const targetName = params.player;
    if (typeof targetName !== 'string') {
      return;
    }
    const targetPlayer =
      executor instanceof mc.Player ? resolveTarget(targetName, executor)[0] : findPlayerByName(targetName);

    if (isDefined(targetPlayer)) {
      if (executor instanceof mc.Player && executor.id !== targetPlayer.id && !canTarget(executor, targetPlayer.id)) {
        executor.sendMessage('§cYou cannot view the inventory of a player with the same or higher rank than you.');
        return;
      }

      executor.sendMessage(`§eInventory of ${targetPlayer.name}:`);
      const inventory = targetPlayer.getComponent(EntityComponentTypes.Inventory)?.container;
      const equipment = targetPlayer.getComponent(EntityComponentTypes.Equippable);

      if (!isDefined(inventory)) {
        executor.sendMessage('§cCould not access inventory.');
        return;
      }

      let output = '';
      if (isDefined(equipment)) {
        output += inspectArmor(equipment);
      }
      output += inspectInventory(inventory);

      if (output.trim().length > 0) {
        executor.sendMessage(output.trim());
      } else {
        executor.sendMessage('§7Inventory is empty.');
      }
      return;
    }

    const offlineId = getPlayerIdByName(targetName);
    if (!isNonEmptyString(offlineId)) {
      executor.sendMessage('§cPlayer not found.');
      return;
    }
    if (executor instanceof mc.Player && executor.id !== offlineId && !canTarget(executor, offlineId)) {
      executor.sendMessage('§cYou cannot view the inventory of a player with the same or higher rank than you.');
      return;
    }

    const offlineData = loadPlayerData(offlineId);
    const displayName = getPlayerNameById(offlineId) ?? targetName;
    if (!isDefined(offlineData)) {
      executor.sendMessage('§cCould not load offline player data.');
      return;
    }

    let output = '';
    if (isDefined(offlineData.offlineEquipment) && Object.keys(offlineData.offlineEquipment).length > 0) {
      output += '§6[Armor & Offhand (Offline)]§r\n';
      for (const [slotName, item] of Object.entries(offlineData.offlineEquipment)) {
        if (isDefined(item)) {
          const name = isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
          output += ` §7${slotName}: §f${name} §7x${item.amount}\n`;
        }
      }
    }
    if (isDefined(offlineData.offlineInventory) && Object.keys(offlineData.offlineInventory).length > 0) {
      output += '§6[Inventory (Offline)]§r\n';
      for (const [slotStr, item] of Object.entries(offlineData.offlineInventory)) {
        const slotIdx = Number(slotStr);
        const name = isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
        const prefix = slotIdx < 9 ? '§e' : '§7';
        output += ` ${prefix}[${slotStr}] §f${name} §7x${item.amount}\n`;
      }
    }

    executor.sendMessage(`§eOffline Inventory of ${displayName}:`);
    if (output.trim().length > 0) {
      executor.sendMessage(output.trim());
    } else {
      executor.sendMessage('§7Offline inventory is empty (or snapshot not yet recorded).');
    }
  },
};

const ecwipeCommand: CustomCommand = {
  name: 'ecwipe',
  description: "Clears an online or offline player's Ender Chest.",
  category: 'Moderation',
  permissionNode: 'cmd.ecwipe.admin',
  allowConsole: true,
  parameters: [{ name: 'player', type: 'string', optional: false }],
  execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
    const targetName = params.player;
    if (typeof targetName !== 'string') {
      return;
    }

    const onlineTarget =
      executor instanceof mc.Player ? resolveTarget(targetName, executor)[0] : findPlayerByName(targetName);
    const targetId = onlineTarget?.id ?? getPlayerIdByName(targetName);

    if (executor instanceof mc.Player && isDefined(targetId) && executor.id !== targetId) {
      if (!canTarget(executor, targetId)) {
        executor.sendMessage('§cYou cannot wipe the ender chest of a player with the same or higher rank than you.');
        return;
      }
    }

    if (isDefined(onlineTarget)) {
      const enderInv = onlineTarget.getComponent(EntityComponentTypes.EnderInventory) as
        mc.EntityEnderInventoryComponent | undefined;
      if (isDefined(enderInv?.container)) {
        enderInv.container.clearAll();
        updatePlayerData(onlineTarget.id, (d) => {
          d.offlineEnderChest = {};
          d.pendingEnderChestWipe = false;
        });
        executor.sendMessage(`§aSuccessfully wiped Ender Chest of ${onlineTarget.name}.`);
        return;
      }
    }

    if (isNonEmptyString(targetId)) {
      const displayName = getPlayerNameById(targetId) ?? targetName;
      updatePlayerData(targetId, (d) => {
        d.offlineEnderChest = {};
        d.pendingEnderChestWipe = true;
      });
      executor.sendMessage(`§aWiped offline Ender Chest of ${displayName} (will apply on next join).`);
      return;
    }

    executor.sendMessage(`§cPlayer "${targetName}" not found.`);
  },
};

const copyinvCommand: CustomCommand = {
  name: 'copyinv',
  description: "Copies another player's inventory to yours.",
  category: 'Moderation',
  permissionNode: 'cmd.copyinv.admin',
  parameters: [{ name: 'player', type: 'string', optional: false }],
  execute: (executor: CommandExecutor, params: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      executor.sendMessage('§cThis command can only be used by players.');
      return;
    }

    const targetName = params.player;
    if (typeof targetName !== 'string') {
      return;
    }
    const targets = resolveTarget(targetName, executor);
    const targetPlayer = targets[0];

    if (!isDefined(targetPlayer)) {
      executor.sendMessage('§cPlayer not found.');
      return;
    }

    if (!canTarget(executor, targetPlayer.id)) {
      executor.sendMessage('§cYou cannot copy the inventory of a player with the same or higher rank than you.');
      return;
    }

    const targetInv = targetPlayer.getComponent(EntityComponentTypes.Inventory)?.container;
    const myInv = executor.getComponent(EntityComponentTypes.Inventory)?.container;

    if (!isDefined(targetInv) || !isDefined(myInv)) {
      executor.sendMessage('§cCould not access inventory.');
      return;
    }

    // Clear my inventory first
    myInv.clearAll();

    // Copy items
    let copiedCount = 0;
    for (let i = 0; i < targetInv.size; i++) {
      const item = targetInv.getItem(i);
      if (isDefined(item)) {
        // Clone the item to avoid reference issues
        myInv.setItem(i, item.clone());
        copiedCount++;
      }
    }

    executor.sendMessage(`§aCopied ${copiedCount} items from ${targetPlayer.name}'s inventory.`);
  },
};

const ecseeCommand: CustomCommand = {
  name: 'ecsee',
  aliases: ['enderchestsee', 'viewec'],
  description: 'View the 27 Ender Chest slots of an online or offline player.',
  category: 'Moderation',
  permissionNode: 'cmd.invsee.mod',
  allowConsole: true,
  parameters: [
    { name: 'player', type: 'string', optional: false },
    { name: 'mode', type: 'string', optional: true, enumOptions: ['chat', 'ui'] },
  ],
  execute: async (executor: CommandExecutor, params: Record<string, unknown>) => {
    const targetName = params.player;
    if (typeof targetName !== 'string') {
      return;
    }
    const targetPlayer =
      executor instanceof mc.Player ? resolveTarget(targetName, executor)[0] : findPlayerByName(targetName);

    if (isDefined(targetPlayer)) {
      if (executor instanceof mc.Player && executor.id !== targetPlayer.id && !canTarget(executor, targetPlayer.id)) {
        executor.sendMessage('§cYou cannot view the Ender Chest of a player with the same or higher rank than you.');
        return;
      }

      if (executor instanceof mc.Player && typeof params.mode === 'string' && params.mode.toLowerCase() === 'ui') {
        const { showEnderChestPanel } = await import('@core/ui/panels/inventoryPanel.js');
        await showEnderChestPanel(executor, targetPlayer.id);
        return;
      }

      const enderInv = targetPlayer.getComponent(EntityComponentTypes.EnderInventory) as
        mc.EntityEnderInventoryComponent | undefined;
      if (!isDefined(enderInv) || !isDefined(enderInv.container)) {
        executor.sendMessage('§cCould not access Ender Chest.');
        return;
      }

      const container = enderInv.container;
      let output = '';
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (isDefined(item)) {
          const name = isDefined(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
          output += ` §d[${i}] §f${name} §7x${item.amount}\n`;
        }
      }

      executor.sendMessage(`§dEnder Chest of ${targetPlayer.name}:`);
      if (output.trim().length > 0) {
        executor.sendMessage(output.trim());
      } else {
        executor.sendMessage('§7Ender Chest is empty.');
      }
      return;
    }

    const offlineId = getPlayerIdByName(targetName);
    if (!isNonEmptyString(offlineId)) {
      executor.sendMessage('§cPlayer not found.');
      return;
    }
    if (executor instanceof mc.Player && executor.id !== offlineId && !canTarget(executor, offlineId)) {
      executor.sendMessage('§cYou cannot view the Ender Chest of a player with the same or higher rank than you.');
      return;
    }

    if (executor instanceof mc.Player && typeof params.mode === 'string' && params.mode.toLowerCase() === 'ui') {
      const { showEnderChestPanel } = await import('@core/ui/panels/inventoryPanel.js');
      await showEnderChestPanel(executor, offlineId);
      return;
    }

    const offlineData = loadPlayerData(offlineId);
    const displayName = getPlayerNameById(offlineId) ?? targetName;
    const ecRecord = offlineData?.offlineEnderChest ?? {};
    let output = '';
    for (const [slotStr, item] of Object.entries(ecRecord)) {
      const name = isNonEmptyString(item.nameTag) ? item.nameTag : item.typeId.replace(/^minecraft:/, '');
      output += ` §d[${slotStr}] §f${name} §7x${item.amount}\n`;
    }

    executor.sendMessage(`§dOffline Ender Chest of ${displayName}:`);
    if (output.trim().length > 0) {
      executor.sendMessage(output.trim());
    } else {
      executor.sendMessage('§7Offline Ender Chest is empty (or snapshot not yet recorded).');
    }
  },
};

export default [invseeCommand, ecseeCommand, ecwipeCommand, copyinvCommand];
